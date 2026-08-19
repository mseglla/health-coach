//
//  HealthKitManager.swift
//  ATLESConnector
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import Foundation
import HealthKit
import Combine

struct WorkoutMetrics {
    let averageHeartRateBpm: Double?
    let maxHeartRateBpm: Double?
    let averagePowerWatts: Double?
    let maxPowerWatts: Double?

    var metadata: [String: Double] {
        var result: [String: Double] = [:]

        if let averageHeartRateBpm {
            result["heart_rate_avg_bpm"] = averageHeartRateBpm
        }

        if let maxHeartRateBpm {
            result["heart_rate_max_bpm"] = maxHeartRateBpm
        }

        if let averagePowerWatts {
            result["power_avg_watts"] = averagePowerWatts
        }

        if let maxPowerWatts {
            result["power_max_watts"] = maxPowerWatts
        }

        return result
    }
}

final class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()

    @Published var todaySteps: Double = 0
    @Published var workouts: [HKWorkout] = []
    @Published var authorizationError: String?

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()

        if let stepType = HKObjectType.quantityType(
            forIdentifier: .stepCount
        ) {
            types.insert(stepType)
        }

        types.insert(HKObjectType.workoutType())

        [
            HKQuantityTypeIdentifier.heartRate,
            HKQuantityTypeIdentifier.runningPower,
            HKQuantityTypeIdentifier.cyclingPower
        ].forEach { identifier in
            if let type = HKObjectType.quantityType(
                forIdentifier: identifier
            ) {
                types.insert(type)
            }
        }

        return types
    }

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            await MainActor.run {
                authorizationError = "HealthKit no està disponible en aquest dispositiu."
            }
            return
        }

        do {
            try await healthStore.requestAuthorization(
                toShare: [],
                read: readTypes
            )

            await loadTodaySteps()
            await loadRecentWorkouts()
        } catch {
            await MainActor.run {
                authorizationError = error.localizedDescription
            }
        }
    }

    func enableBackgroundDelivery() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            return
        }

        let types: [(HKSampleType, HKUpdateFrequency)] = [
            (
                HKObjectType.quantityType(forIdentifier: .stepCount),
                .hourly
            ),
            (
                HKObjectType.workoutType(),
                .immediate
            )
        ].compactMap { type, frequency in
            guard let type else { return nil }
            return (type, frequency)
        }

        for (type, frequency) in types {
            do {
                try await healthStore.enableBackgroundDelivery(
                    for: type,
                    frequency: frequency
                )

            } catch {
                await MainActor.run {
                    authorizationError = error.localizedDescription
                }
            }
        }
    }

    func startObservers(
        onStepsChanged: @escaping () async -> Void,
        onWorkoutsChanged: @escaping () async -> Void
    ) {
        if let stepType = HKObjectType.quantityType(
            forIdentifier: .stepCount
        ) {
            let stepObserver = HKObserverQuery(
                sampleType: stepType,
                predicate: nil
            ) { _, completionHandler, error in
                guard error == nil else {
                    completionHandler()
                    return
                }

                Task {
                    await onStepsChanged()
                    completionHandler()
                }
            }

            healthStore.execute(stepObserver)
        }

        let workoutObserver = HKObserverQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: nil
        ) { _, completionHandler, error in
            guard error == nil else {
                completionHandler()
                return
            }

            Task {
                await onWorkoutsChanged()
                completionHandler()
            }
        }

        healthStore.execute(workoutObserver)
    }

    func loadTodaySteps() async {
        guard let stepType = HKQuantityType.quantityType(
            forIdentifier: .stepCount
        ) else {
            return
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())

        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: Date(),
            options: .strictStartDate
        )

        do {
            let result = try await withCheckedThrowingContinuation {
                (continuation: CheckedContinuation<Double, Error>) in

                let query = HKStatisticsQuery(
                    quantityType: stepType,
                    quantitySamplePredicate: predicate,
                    options: .cumulativeSum
                ) { _, statistics, error in

                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    let steps = statistics?
                        .sumQuantity()?
                        .doubleValue(for: .count()) ?? 0

                    continuation.resume(returning: steps)
                }

                healthStore.execute(query)
            }

            await MainActor.run {
                todaySteps = result
            }
        } catch {
            await MainActor.run {
                authorizationError = error.localizedDescription
            }
        }
    }

    func loadWorkoutMetrics(
        for workouts: [HKWorkout]
    ) async -> [UUID: WorkoutMetrics] {
        var result: [UUID: WorkoutMetrics] = [:]

        for workout in workouts {
            result[workout.uuid] = await loadWorkoutMetrics(
                for: workout
            )
        }

        return result
    }

    private func loadWorkoutMetrics(
        for workout: HKWorkout
    ) async -> WorkoutMetrics {
        let heartRate = await quantityStatistics(
            identifier: .heartRate,
            unit: HKUnit.count().unitDivided(
                by: HKUnit.minute()
            ),
            workout: workout
        )

        let powerIdentifier: HKQuantityTypeIdentifier?

        switch workout.workoutActivityType {
        case .running:
            powerIdentifier = .runningPower
        case .cycling:
            powerIdentifier = .cyclingPower
        default:
            powerIdentifier = nil
        }

        let power: (
            average: Double?,
            maximum: Double?
        )

        if let powerIdentifier {
            power = await quantityStatistics(
                identifier: powerIdentifier,
                unit: HKUnit.watt(),
                workout: workout
            )
        } else {
            power = (nil, nil)
        }

        return WorkoutMetrics(
            averageHeartRateBpm: heartRate.average,
            maxHeartRateBpm: heartRate.maximum,
            averagePowerWatts: power.average,
            maxPowerWatts: power.maximum
        )
    }

    private func quantityStatistics(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        workout: HKWorkout
    ) async -> (
        average: Double?,
        maximum: Double?
    ) {
        guard let quantityType = HKQuantityType.quantityType(
            forIdentifier: identifier
        ) else {
            return (nil, nil)
        }

        let predicate = HKQuery.predicateForObjects(
            from: workout
        )

        return await withCheckedContinuation {
            (
                continuation:
                CheckedContinuation<
                    (
                        average: Double?,
                        maximum: Double?
                    ),
                    Never
                >
            ) in

            let query = HKStatisticsQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: [
                    .discreteAverage,
                    .discreteMax
                ]
            ) { _, statistics, error in

                guard error == nil else {
                    continuation.resume(
                        returning: (nil, nil)
                    )
                    return
                }

                let average = statistics?
                    .averageQuantity()?
                    .doubleValue(for: unit)

                let maximum = statistics?
                    .maximumQuantity()?
                    .doubleValue(for: unit)

                continuation.resume(
                    returning: (average, maximum)
                )
            }

            healthStore.execute(query)
        }
    }

    func loadRecentWorkouts() async {
        let workoutType = HKObjectType.workoutType()

        let sort = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        do {
            let result = try await withCheckedThrowingContinuation {
                (continuation: CheckedContinuation<[HKWorkout], Error>) in

                let query = HKSampleQuery(
                    sampleType: workoutType,
                    predicate: nil,
                    limit: 10,
                    sortDescriptors: [sort]
                ) { _, samples, error in

                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    let workouts = samples as? [HKWorkout] ?? []
                    continuation.resume(returning: workouts)
                }

                healthStore.execute(query)
            }

            await MainActor.run {
                workouts = result
            }
        } catch {
            await MainActor.run {
                authorizationError = error.localizedDescription
            }
        }
    }
}
