//
//  HealthKitManager.swift
//  ATLESConnector
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import Foundation
import HealthKit
import Combine

struct DailyHealthMetric {
    let date: Date
    let metricType: String
    let value: Double
    let unit: String
}

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
            HKQuantityTypeIdentifier.distanceWalkingRunning,
            HKQuantityTypeIdentifier.activeEnergyBurned,
            HKQuantityTypeIdentifier.basalEnergyBurned,
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

    func loadRecentStepHistory(
        days: Int = 7
    ) async throws -> [DailyHealthMetric] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        guard let startDate = calendar.date(
            byAdding: .day,
            value: -(max(days, 1) - 1),
            to: today
        ) else {
            return []
        }

        return try await loadStepHistory(
            from: startDate,
            to: Date()
        )
    }

    func loadStepHistory(
        from startDate: Date? = nil,
        to endDate: Date = Date()
    ) async throws -> [DailyHealthMetric] {
        guard let stepType = HKQuantityType.quantityType(
            forIdentifier: .stepCount
        ) else {
            return []
        }

        let effectiveStart: Date

        if let startDate {
            effectiveStart = Calendar.current.startOfDay(
                for: startDate
            )
        } else {
            guard let earliestDate =
                try await earliestSampleDate(
                    for: stepType
                )
            else {
                return []
            }

            effectiveStart = Calendar.current.startOfDay(
                for: earliestDate
            )
        }

        let effectiveEnd = min(endDate, Date())

        guard effectiveStart <= effectiveEnd else {
            return []
        }

        return try await dailyCumulativeValues(
            quantityType: stepType,
            unit: .count(),
            metricType: "steps",
            metricUnit: "count",
            decimalPlaces: 0,
            from: effectiveStart,
            to: effectiveEnd
        )
    }

    func loadRecentDailyHistory(
        days: Int = 7,
        baselineDays: Int = 30
    ) async throws -> [DailyHealthMetric] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        let syncDays = max(days, 1)
        let contextDays = max(
            baselineDays,
            syncDays
        )

        guard
            let syncStart = calendar.date(
                byAdding: .day,
                value: -(syncDays - 1),
                to: today
            ),
            let baselineStart = calendar.date(
                byAdding: .day,
                value: -(contextDays - 1),
                to: today
            )
        else {
            return []
        }

        // Carreguem una finestra més ampla perquè
        // total_kcal pugui estimar una cobertura
        // basal estable.
        let metrics = try await loadDailyHistory(
            from: baselineStart,
            to: Date()
        )

        // Però només sincronitzem els dies demanats.
        return metrics.filter { metric in
            calendar.startOfDay(
                for: metric.date
            ) >= syncStart
        }
    }

    func loadDailyHistory(
        from startDate: Date? = nil,
        to endDate: Date = Date()
    ) async throws -> [DailyHealthMetric] {
        var result: [DailyHealthMetric] = []

        do {
            result += try await loadStepHistory(
                from: startDate,
                to: endDate
            )
        } catch {
            print(
                "ATLES HealthKit steps failed:",
                error.localizedDescription
            )
        }

        do {
            result += try await loadDistanceHistoryFromSamples(
                from: startDate,
                to: endDate
            )
        } catch {
            print(
                "ATLES HealthKit distance failed:",
                error.localizedDescription
            )
        }

        do {
            result += try await loadHeartRateHistory(
                from: startDate,
                to: endDate
            )
        } catch {
            print(
                "ATLES HealthKit heart rate failed:",
                error.localizedDescription
            )
        }

        var activeMetrics: [DailyHealthMetric] = []

        do {
            activeMetrics =
                try await loadCumulativeHistory(
                    identifier: .activeEnergyBurned,
                    unit: .kilocalorie(),
                    metricType: "active_kcal",
                    metricUnit: "kcal",
                    decimalPlaces: 1,
                    from: startDate,
                    to: endDate
                )

            result += activeMetrics
        } catch {
            print(
                "ATLES HealthKit active energy failed:",
                error.localizedDescription
            )
        }

        var restingMetrics: [DailyHealthMetric] = []

        do {
            restingMetrics =
                try await loadCumulativeHistory(
                    identifier: .basalEnergyBurned,
                    unit: .kilocalorie(),
                    metricType: "resting_kcal",
                    metricUnit: "kcal",
                    decimalPlaces: 1,
                    from: startDate,
                    to: endDate
                )

            result += restingMetrics
        } catch {
            print(
                "ATLES HealthKit resting energy failed:",
                error.localizedDescription
            )
        }

        result += makeTotalEnergyMetrics(
            active: activeMetrics,
            resting: restingMetrics
        )

        return result.sorted {
            if $0.date == $1.date {
                return $0.metricType < $1.metricType
            }

            return $0.date < $1.date
        }
    }

    private func loadHeartRateHistory(
        from startDate: Date?,
        to endDate: Date
    ) async throws -> [DailyHealthMetric] {
        guard let quantityType =
            HKQuantityType.quantityType(
                forIdentifier: .heartRate
            )
        else {
            return []
        }

        let effectiveStart: Date

        if let startDate {
            effectiveStart =
                Calendar.current.startOfDay(
                    for: startDate
                )
        } else {
            guard let earliestDate =
                try await earliestSampleDate(
                    for: quantityType
                )
            else {
                return []
            }

            effectiveStart =
                Calendar.current.startOfDay(
                    for: earliestDate
                )
        }

        let effectiveEnd = min(
            endDate,
            Date()
        )

        guard effectiveStart <= effectiveEnd else {
            return []
        }

        return try await dailyHeartRateValues(
            quantityType: quantityType,
            from: effectiveStart,
            to: effectiveEnd
        )
    }

    private func loadDistanceHistoryFromSamples(
        from startDate: Date?,
        to endDate: Date
    ) async throws -> [DailyHealthMetric] {
        guard let quantityType =
            HKQuantityType.quantityType(
                forIdentifier: .distanceWalkingRunning
            )
        else {
            return []
        }

        let effectiveStart: Date

        if let startDate {
            effectiveStart =
                Calendar.current.startOfDay(
                    for: startDate
                )
        } else {
            guard let earliestDate =
                try await earliestSampleDate(
                    for: quantityType
                )
            else {
                return []
            }

            effectiveStart =
                Calendar.current.startOfDay(
                    for: earliestDate
                )
        }

        let effectiveEnd = min(
            endDate,
            Date()
        )

        guard effectiveStart <= effectiveEnd else {
            return []
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: effectiveStart,
            end: effectiveEnd,
            options: .strictStartDate
        )

        let samples: [HKQuantitySample] =
            try await withCheckedThrowingContinuation {
                (
                    continuation:
                    CheckedContinuation<
                        [HKQuantitySample],
                        Error
                    >
                ) in

                let query = HKSampleQuery(
                    sampleType: quantityType,
                    predicate: predicate,
                    limit: HKObjectQueryNoLimit,
                    sortDescriptors: nil
                ) { _, samples, error in
                    if let error {
                        continuation.resume(
                            throwing: error
                        )
                        return
                    }

                    continuation.resume(
                        returning:
                            samples as? [HKQuantitySample]
                            ?? []
                    )
                }

                healthStore.execute(query)
            }

        let calendar = Calendar.current

        var totalsByDay: [Date: Double] = [:]

        for sample in samples {
            let day = calendar.startOfDay(
                for: sample.startDate
            )

            let meters =
                sample.quantity.doubleValue(
                    for: .meter()
                )

            totalsByDay[day, default: 0] += meters
        }

        return totalsByDay
            .keys
            .sorted()
            .map { date in
                DailyHealthMetric(
                    date: date,
                    metricType: "distance_m",
                    value: rounded(
                        totalsByDay[date] ?? 0,
                        decimalPlaces: 0
                    ),
                    unit: "m"
                )
            }
    }

    private func loadCumulativeHistory(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        metricType: String,
        metricUnit: String,
        decimalPlaces: Int,
        from startDate: Date?,
        to endDate: Date
    ) async throws -> [DailyHealthMetric] {
        guard let quantityType = HKQuantityType.quantityType(
            forIdentifier: identifier
        ) else {
            return []
        }

        let effectiveStart: Date

        if let startDate {
            effectiveStart = Calendar.current.startOfDay(
                for: startDate
            )
        } else {
            guard let earliestDate =
                try await earliestSampleDate(
                    for: quantityType
                )
            else {
                return []
            }

            effectiveStart = Calendar.current.startOfDay(
                for: earliestDate
            )
        }

        let effectiveEnd = min(endDate, Date())

        guard effectiveStart <= effectiveEnd else {
            return []
        }

        return try await dailyCumulativeValues(
            quantityType: quantityType,
            unit: unit,
            metricType: metricType,
            metricUnit: metricUnit,
            decimalPlaces: decimalPlaces,
            from: effectiveStart,
            to: effectiveEnd
        )
    }

    private func makeTotalEnergyMetrics(
        active: [DailyHealthMetric],
        resting: [DailyHealthMetric]
    ) -> [DailyHealthMetric] {
        let calendar = Calendar.current

        let activeByDay = Dictionary(
            uniqueKeysWithValues: active.map {
                (
                    calendar.startOfDay(for: $0.date),
                    $0.value
                )
            }
        )

        let restingByDay = Dictionary(
            uniqueKeysWithValues: resting.map {
                (
                    calendar.startOfDay(for: $0.date),
                    $0.value
                )
            }
        )

        let restingValues = resting
            .map(\.value)
            .sorted()

        guard !restingValues.isEmpty else {
            return []
        }

        let middle = restingValues.count / 2

        let medianResting: Double

        if restingValues.count.isMultiple(of: 2) {
            medianResting =
                (
                    restingValues[middle - 1] +
                    restingValues[middle]
                ) / 2
        } else {
            medianResting =
                restingValues[middle]
        }

        let minimumCoverageResting =
            medianResting * 0.70

        let dates = Set(activeByDay.keys)
            .intersection(restingByDay.keys)

        return dates.sorted().compactMap { date in
            guard
                let activeValue = activeByDay[date],
                let restingValue = restingByDay[date],
                restingValue >= minimumCoverageResting
            else {
                return nil
            }

            return DailyHealthMetric(
                date: date,
                metricType: "total_kcal",
                value: rounded(
                    activeValue + restingValue,
                    decimalPlaces: 1
                ),
                unit: "kcal"
            )
        }
    }

    private func rounded(
        _ value: Double,
        decimalPlaces: Int
    ) -> Double {
        guard decimalPlaces > 0 else {
            return value.rounded()
        }

        let factor = pow(
            10.0,
            Double(decimalPlaces)
        )

        return (value * factor).rounded() / factor
    }

    private func earliestSampleDate(
        for sampleType: HKSampleType
    ) async throws -> Date? {
        try await withCheckedThrowingContinuation {
            (
                continuation:
                CheckedContinuation<Date?, Error>
            ) in

            let sort = NSSortDescriptor(
                key: HKSampleSortIdentifierStartDate,
                ascending: true
            )

            let query = HKSampleQuery(
                sampleType: sampleType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(
                        throwing: error
                    )
                    return
                }

                continuation.resume(
                    returning: samples?.first?.startDate
                )
            }

            healthStore.execute(query)
        }
    }

    private func dailyHeartRateValues(
        quantityType: HKQuantityType,
        from startDate: Date,
        to endDate: Date
    ) async throws -> [DailyHealthMetric] {
        let calendar = Calendar.current
        let anchorDate = calendar.startOfDay(
            for: startDate
        )

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        let unit = HKUnit.count().unitDivided(
            by: HKUnit.minute()
        )

        return try await withCheckedThrowingContinuation {
            (
                continuation:
                CheckedContinuation<
                    [DailyHealthMetric],
                    Error
                >
            ) in

            let query = HKStatisticsCollectionQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: [
                    .discreteAverage,
                    .discreteMin,
                    .discreteMax
                ],
                anchorDate: anchorDate,
                intervalComponents: DateComponents(
                    day: 1
                )
            )

            query.initialResultsHandler = {
                _,
                collection,
                error in

                if let error {
                    continuation.resume(
                        throwing: error
                    )
                    return
                }

                guard let collection else {
                    continuation.resume(
                        returning: []
                    )
                    return
                }

                var result: [DailyHealthMetric] = []

                collection.enumerateStatistics(
                    from: startDate,
                    to: endDate
                ) { statistics, _ in
                    let values: [
                        (
                            metricType: String,
                            quantity: HKQuantity?
                        )
                    ] = [
                        (
                            "heart_rate_avg_bpm",
                            statistics.averageQuantity()
                        ),
                        (
                            "heart_rate_min_bpm",
                            statistics.minimumQuantity()
                        ),
                        (
                            "heart_rate_max_bpm",
                            statistics.maximumQuantity()
                        )
                    ]

                    for value in values {
                        guard let quantity = value.quantity else {
                            continue
                        }

                        result.append(
                            DailyHealthMetric(
                                date: statistics.startDate,
                                metricType:
                                    value.metricType,
                                value: self.rounded(
                                    quantity.doubleValue(
                                        for: unit
                                    ),
                                    decimalPlaces: 1
                                ),
                                unit: "bpm"
                            )
                        )
                    }
                }

                continuation.resume(
                    returning: result
                )
            }

            healthStore.execute(query)
        }
    }

    private func dailyCumulativeValues(
        quantityType: HKQuantityType,
        unit: HKUnit,
        metricType: String,
        metricUnit: String,
        decimalPlaces: Int,
        from startDate: Date,
        to endDate: Date
    ) async throws -> [DailyHealthMetric] {
        let calendar = Calendar.current
        let anchorDate = calendar.startOfDay(
            for: startDate
        )

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return try await withCheckedThrowingContinuation {
            (
                continuation:
                CheckedContinuation<
                    [DailyHealthMetric],
                    Error
                >
            ) in

            let query = HKStatisticsCollectionQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: anchorDate,
                intervalComponents: DateComponents(
                    day: 1
                )
            )

            query.initialResultsHandler = {
                _,
                collection,
                error in

                if let error {
                    continuation.resume(
                        throwing: error
                    )
                    return
                }

                guard let collection else {
                    continuation.resume(
                        returning: []
                    )
                    return
                }

                var result: [DailyHealthMetric] = []

                collection.enumerateStatistics(
                    from: startDate,
                    to: endDate
                ) { statistics, _ in
                    guard let quantity =
                        statistics.sumQuantity()
                    else {
                        return
                    }

                    result.append(
                        DailyHealthMetric(
                            date: statistics.startDate,
                            metricType: metricType,
                            value: self.rounded(
                                quantity.doubleValue(
                                    for: unit
                                ),
                                decimalPlaces:
                                    decimalPlaces
                            ),
                            unit: metricUnit
                        )
                    )
                }

                continuation.resume(
                    returning: result
                )
            }

            healthStore.execute(query)
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

    func loadWorkoutHistory(
        from startDate: Date? = nil,
        to endDate: Date = Date()
    ) async throws -> [HKWorkout] {
        let workoutType = HKObjectType.workoutType()

        let predicate: NSPredicate?

        if let startDate {
            predicate = HKQuery.predicateForSamples(
                withStart: startDate,
                end: min(endDate, Date()),
                options: .strictStartDate
            )
        } else {
            predicate = HKQuery.predicateForSamples(
                withStart: nil,
                end: min(endDate, Date()),
                options: []
            )
        }

        let sort = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: true
        )

        return try await withCheckedThrowingContinuation {
            (
                continuation:
                CheckedContinuation<[HKWorkout], Error>
            ) in

            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort]
            ) { _, samples, error in

                if let error {
                    continuation.resume(
                        throwing: error
                    )
                    return
                }

                continuation.resume(
                    returning:
                        samples as? [HKWorkout] ?? []
                )
            }

            healthStore.execute(query)
        }
    }

    func loadRecentWorkoutHistory(
        days: Int = 14
    ) async throws -> [HKWorkout] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        guard let startDate = calendar.date(
            byAdding: .day,
            value: -(max(days, 1) - 1),
            to: today
        ) else {
            return []
        }

        return try await loadWorkoutHistory(
            from: startDate,
            to: Date()
        )
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
