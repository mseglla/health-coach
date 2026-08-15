//
//  HealthKitManager.swift
//  ATLESConnector
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import Foundation
import HealthKit
import Combine

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

        let types: [HKSampleType] = [
            HKObjectType.quantityType(forIdentifier: .stepCount),
            HKObjectType.workoutType()
        ].compactMap { $0 }

        for type in types {
            do {
                try await healthStore.enableBackgroundDelivery(
                    for: type,
                    frequency: .hourly
                )
            } catch {
                await MainActor.run {
                    authorizationError = error.localizedDescription
                }
            }
        }
    }

    func startObservers(
        onStepsChanged: @escaping () -> Void,
        onWorkoutsChanged: @escaping () -> Void
    ) {
        if let stepType = HKObjectType.quantityType(
            forIdentifier: .stepCount
        ) {
            let stepObserver = HKObserverQuery(
                sampleType: stepType,
                predicate: nil
            ) { _, completionHandler, error in
                if error == nil {
                    onStepsChanged()
                }

                completionHandler()
            }

            healthStore.execute(stepObserver)
        }

        let workoutObserver = HKObserverQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: nil
        ) { _, completionHandler, error in
            if error == nil {
                onWorkoutsChanged()
            }

            completionHandler()
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
