//
//  SupabaseHealthSyncManager.swift
//  
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import Foundation
import Combine
import HealthKit

@MainActor
final class SupabaseHealthSyncManager: ObservableObject {
    @Published var isSyncing = false
    @Published var syncMessage: String?
    @Published var errorMessage: String?

    private let supabaseURL =
        "https://zyjzyyudftnmfjbseibi.supabase.co"

    private let publishableKey =
        "sb_publishable_IboCUET8TK_jL3TjcX1K5g_z7cZBnN0"

    func syncTodaySteps(
        steps: Double,
        userId: String,
        accessToken: String
    ) async {
        isSyncing = true
        syncMessage = nil
        errorMessage = nil

        defer {
            isSyncing = false
        }

        guard steps >= 0 else {
            errorMessage = "El nombre de passos no és vàlid."
            return
        }

        let path =
            "/rest/v1/health_daily_metrics" +
            "?on_conflict=user_id,metric_date,metric_type,source"

        guard let url = URL(string: supabaseURL + path) else {
            errorMessage = "URL de sincronització no vàlida."
            return
        }

        let dateFormatter = DateFormatter()
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.timeZone = .current
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let metricDate = dateFormatter.string(from: Date())

        let payload = HealthDailyMetricPayload(
            userId: userId,
            metricDate: metricDate,
            metricType: "steps",
            value: steps,
            unit: "count",
            source: "healthkit",
            timezone: TimeZone.current.identifier,
            importedAt: ISO8601DateFormatter().string(from: Date()),
            deletedAt: nil
        )

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        request.setValue(
            publishableKey,
            forHTTPHeaderField: "apikey"
        )

        request.setValue(
            "Bearer \(accessToken)",
            forHTTPHeaderField: "Authorization"
        )

        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )

        request.setValue(
            "resolution=merge-duplicates,return=representation",
            forHTTPHeaderField: "Prefer"
        )

        do {
            request.httpBody = try JSONEncoder().encode(payload)

            let (data, response) = try await URLSession.shared.data(
                for: request
            )

            guard let httpResponse = response as? HTTPURLResponse else {
                errorMessage = "Resposta no vàlida de Supabase."
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let detail = String(
                    data: data,
                    encoding: .utf8
                ) ?? "Error desconegut"

                errorMessage =
                    "Supabase ha rebutjat la sincronització: \(detail)"

                return
            }

            syncMessage =
                "\(Int(steps)) passos sincronitzats amb ATLES."

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func syncStepHistory(
        metrics: [DailyHealthMetric],
        userId: String,
        accessToken: String
    ) async {
        await syncDailyMetrics(
            metrics: metrics,
            userId: userId,
            accessToken: accessToken
        )
    }

    func syncDailyMetrics(
        metrics: [DailyHealthMetric],
        userId: String,
        accessToken: String
    ) async {
        isSyncing = true
        syncMessage = nil
        errorMessage = nil

        defer {
            isSyncing = false
        }

        guard !metrics.isEmpty else {
            syncMessage =
                "No hi ha mètriques per sincronitzar."
            return
        }

        let path =
            "/rest/v1/health_daily_metrics" +
            "?on_conflict=user_id,metric_date,metric_type,source"

        guard let url = URL(
            string: supabaseURL + path
        ) else {
            errorMessage =
                "URL de sincronització no vàlida."
            return
        }

        let dateFormatter = DateFormatter()
        dateFormatter.calendar =
            Calendar(identifier: .gregorian)
        dateFormatter.locale =
            Locale(identifier: "en_US_POSIX")
        dateFormatter.timeZone = .current
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let importedAt =
            ISO8601DateFormatter().string(
                from: Date()
            )

        let payload = metrics.map { metric in
            HealthDailyMetricPayload(
                userId: userId,
                metricDate: dateFormatter.string(
                    from: metric.date
                ),
                metricType: metric.metricType,
                value: metric.value,
                unit: metric.unit,
                source: "healthkit",
                timezone:
                    TimeZone.current.identifier,
                importedAt: importedAt,
                deletedAt: nil
            )
        }

        let chunkSize = 250
        var importedCount = 0

        do {
            for start in stride(
                from: 0,
                to: payload.count,
                by: chunkSize
            ) {
                let end = min(
                    start + chunkSize,
                    payload.count
                )

                let chunk = Array(
                    payload[start..<end]
                )

                var request = URLRequest(url: url)
                request.httpMethod = "POST"

                request.setValue(
                    publishableKey,
                    forHTTPHeaderField: "apikey"
                )

                request.setValue(
                    "Bearer \(accessToken)",
                    forHTTPHeaderField:
                        "Authorization"
                )

                request.setValue(
                    "application/json",
                    forHTTPHeaderField:
                        "Content-Type"
                )

                request.setValue(
                    "resolution=merge-duplicates",
                    forHTTPHeaderField: "Prefer"
                )

                request.httpBody =
                    try JSONEncoder().encode(chunk)

                let (data, response) =
                    try await URLSession.shared.data(
                        for: request
                    )

                guard
                    let httpResponse =
                        response as? HTTPURLResponse
                else {
                    errorMessage =
                        "Resposta no vàlida de Supabase."
                    return
                }

                guard
                    (200...299).contains(
                        httpResponse.statusCode
                    )
                else {
                    let detail = String(
                        data: data,
                        encoding: .utf8
                    ) ?? "Error desconegut"

                    errorMessage =
                        "Error important mètriques: \(detail)"
                    return
                }

                importedCount += chunk.count
            }

            let types = Set(
                metrics.map(\.metricType)
            ).count

            syncMessage =
                "\(importedCount) mètriques de \(types) tipus sincronitzades."

        } catch {
            errorMessage =
                error.localizedDescription
        }
    }

    func syncWorkouts(
        workouts: [HKWorkout],
        metricsByWorkout: [UUID: WorkoutMetrics],
        userId: String,
        accessToken: String
    ) async {
        isSyncing = true
        syncMessage = nil
        errorMessage = nil

        defer {
            isSyncing = false
        }

        guard !workouts.isEmpty else {
            syncMessage = "No hi ha entrenaments per sincronitzar."
            return
        }

        let path =
            "/rest/v1/activity_logs" +
            "?on_conflict=user_id,source,external_id"

        guard let url = URL(string: supabaseURL + path) else {
            errorMessage = "URL de sincronització no vàlida."
            return
        }

        let isoFormatter = ISO8601DateFormatter()

        let payload = workouts.map { workout in
            let metrics = metricsByWorkout[workout.uuid]

            return ActivityLogPayload(
                userId: userId,
                activityType: activityTypeName(workout),
                startedAt: isoFormatter.string(from: workout.startDate),
                endedAt: isoFormatter.string(from: workout.endDate),
                durationMinutes: workout.duration / 60,
                activeCalories:
                    HKQuantityType.quantityType(
                        forIdentifier: .activeEnergyBurned
                    )
                    .flatMap { workout.statistics(for: $0) }
                    .flatMap { $0.sumQuantity() }
                    .map { $0.doubleValue(for: .kilocalorie()) },
                distanceMeters: workout.totalDistance?
                    .doubleValue(for: .meter()),
                source: "healthkit",
                externalId: workout.uuid.uuidString,
                sourceBundleId:
                    workout.sourceRevision.source.bundleIdentifier,
                sourceDevice: workout.device?.name,
                timezone: TimeZone.current.identifier,
                metadata: metrics?.metadata ?? [:],
                importedAt: isoFormatter.string(from: Date()),
                deletedAt: nil
            )
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        request.setValue(
            publishableKey,
            forHTTPHeaderField: "apikey"
        )

        request.setValue(
            "Bearer \(accessToken)",
            forHTTPHeaderField: "Authorization"
        )

        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )

        request.setValue(
            "resolution=merge-duplicates,return=representation",
            forHTTPHeaderField: "Prefer"
        )

        do {
            request.httpBody = try JSONEncoder().encode(payload)

            let (data, response) = try await URLSession.shared.data(
                for: request
            )

            guard let httpResponse = response as? HTTPURLResponse else {
                errorMessage = "Resposta no vàlida de Supabase."
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let detail = String(
                    data: data,
                    encoding: .utf8
                ) ?? "Error desconegut"

                errorMessage =
                    "Supabase ha rebutjat els entrenaments: \(detail)"
                return
            }

            syncMessage =
                "\(workouts.count) entrenaments sincronitzats amb ATLES."

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func activityTypeName(_ workout: HKWorkout) -> String {
        switch workout.workoutActivityType {
        case .running:
            return "running"
        case .walking:
            return "walking"
        case .cycling:
            return "cycling"
        case .coreTraining:
            return "core_training"
        case .traditionalStrengthTraining:
            return "strength_training"
        case .functionalStrengthTraining:
            return "functional_strength_training"
        case .highIntensityIntervalTraining:
            return "hiit"
        case .swimming:
            return "swimming"
        case .hiking:
            return "hiking"
        case .yoga:
            return "yoga"
        case .pilates:
            return "pilates"
        case .rowing:
            return "rowing"
        case .elliptical:
            return "elliptical"
        case .stairClimbing:
            return "stair_climbing"
        case .dance:
            return "dance"
        case .soccer:
            return "soccer"
        case .tennis:
            return "tennis"
        case .paddleSports:
            return "paddle_sports"
        default:
            return "workout_\(workout.workoutActivityType.rawValue)"
        }
    }
}

private struct ActivityLogPayload: Encodable {
    let userId: String
    let activityType: String
    let startedAt: String
    let endedAt: String
    let durationMinutes: Double
    let activeCalories: Double?
    let distanceMeters: Double?
    let source: String
    let externalId: String
    let sourceBundleId: String
    let sourceDevice: String?
    let timezone: String
    let metadata: [String: Double]
    let importedAt: String
    let deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case activityType = "activity_type"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case durationMinutes = "duration_minutes"
        case activeCalories = "active_calories"
        case distanceMeters = "distance_meters"
        case source
        case externalId = "external_id"
        case sourceBundleId = "source_bundle_id"
        case sourceDevice = "source_device"
        case timezone
        case metadata
        case importedAt = "imported_at"
        case deletedAt = "deleted_at"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(
            keyedBy: CodingKeys.self
        )

        try container.encode(userId, forKey: .userId)
        try container.encode(activityType, forKey: .activityType)
        try container.encode(startedAt, forKey: .startedAt)
        try container.encode(endedAt, forKey: .endedAt)
        try container.encode(
            durationMinutes,
            forKey: .durationMinutes
        )

        if let activeCalories {
            try container.encode(
                activeCalories,
                forKey: .activeCalories
            )
        } else {
            try container.encodeNil(forKey: .activeCalories)
        }

        if let distanceMeters {
            try container.encode(
                distanceMeters,
                forKey: .distanceMeters
            )
        } else {
            try container.encodeNil(forKey: .distanceMeters)
        }

        try container.encode(source, forKey: .source)
        try container.encode(externalId, forKey: .externalId)
        try container.encode(
            sourceBundleId,
            forKey: .sourceBundleId
        )

        if let sourceDevice {
            try container.encode(
                sourceDevice,
                forKey: .sourceDevice
            )
        } else {
            try container.encodeNil(forKey: .sourceDevice)
        }

        try container.encode(timezone, forKey: .timezone)
        try container.encode(metadata, forKey: .metadata)
        try container.encode(importedAt, forKey: .importedAt)

        if let deletedAt {
            try container.encode(
                deletedAt,
                forKey: .deletedAt
            )
        } else {
            try container.encodeNil(forKey: .deletedAt)
        }
    }
}

private struct HealthDailyMetricPayload: Encodable {
    let userId: String
    let metricDate: String
    let metricType: String
    let value: Double
    let unit: String
    let source: String
    let timezone: String
    let importedAt: String
    let deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case metricDate = "metric_date"
        case metricType = "metric_type"
        case value
        case unit
        case source
        case timezone
        case importedAt = "imported_at"
        case deletedAt = "deleted_at"
    }
}
