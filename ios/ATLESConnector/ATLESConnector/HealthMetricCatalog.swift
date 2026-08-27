import Foundation
import HealthKit

enum HealthObservationRoute {
    case daily, heartRate, workouts, samples(HealthSampleKind)
}

struct HealthMetricDescriptor {
    let type: HKSampleType
    let route: HealthObservationRoute
    let frequency: HKUpdateFrequency
}

enum HealthMetricCatalog {
    // Off by default. Do not enable until the target database and migration are verified.
    static var expandedImportEnabled: Bool {
        let value = Bundle.main.object(forInfoDictionaryKey: "ATLESHealthIngestionV2Enabled")
        return (value as? Bool == true) || (value as? String)?.uppercased() == "YES"
    }

    static func sampleType(for kind: HealthSampleKind) -> HKSampleType {
        switch kind {
        case .restingHeartRate: return HKQuantityType(.restingHeartRate)
        case .hrv: return HKQuantityType(.heartRateVariabilitySDNN)
        case .vo2Max: return HKQuantityType(.vo2Max)
        case .bodyMass: return HKQuantityType(.bodyMass)
        case .bodyFat: return HKQuantityType(.bodyFatPercentage)
        case .leanBodyMass: return HKQuantityType(.leanBodyMass)
        case .sleep: return HKCategoryType(.sleepAnalysis)
        }
    }

    static func unit(for kind: HealthSampleKind) -> HKUnit? {
        switch kind {
        case .restingHeartRate: return .count().unitDivided(by: .minute())
        case .hrv: return .secondUnit(with: .milli)
        case .vo2Max:
            return HKUnit.literUnit(with: .milli).unitDivided(
                by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute()))
        case .bodyMass, .leanBodyMass: return .gramUnit(with: .kilo)
        case .bodyFat: return .percent()
        case .sleep: return nil
        }
    }

    static var legacy: [HealthMetricDescriptor] {
        [
            .init(type: HKQuantityType(.stepCount), route: .daily, frequency: .hourly),
            .init(type: HKQuantityType(.distanceWalkingRunning), route: .daily, frequency: .hourly),
            .init(type: HKQuantityType(.activeEnergyBurned), route: .daily, frequency: .hourly),
            .init(type: HKQuantityType(.basalEnergyBurned), route: .daily, frequency: .hourly),
            .init(type: HKQuantityType(.heartRate), route: .heartRate, frequency: .hourly),
            .init(type: HKObjectType.workoutType(), route: .workouts, frequency: .immediate)
        ]
    }

    static var expanded: [HealthMetricDescriptor] {
        HealthSampleKind.allCases.map {
            .init(type: sampleType(for: $0), route: .samples($0), frequency: .hourly)
        }
    }

    static var observed: [HealthMetricDescriptor] {
        // Preserve the existing triggers for aggregates. Their window-based path is unchanged.
        let originalTriggers: Set<String> = [HKQuantityTypeIdentifier.stepCount.rawValue,
            HKQuantityTypeIdentifier.heartRate.rawValue, HKObjectType.workoutType().identifier]
        return legacy.filter { originalTriggers.contains($0.type.identifier) }
            + (expandedImportEnabled ? expanded : [])
    }

    static var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>(legacy.map { $0.type })
        if expandedImportEnabled { types.formUnion(expanded.map { $0.type }) }
        types.insert(HKQuantityType(.runningPower))
        types.insert(HKQuantityType(.cyclingPower))
        return types
    }
}
