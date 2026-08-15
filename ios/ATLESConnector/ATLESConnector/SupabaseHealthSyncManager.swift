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

    func syncWorkouts(
        workouts: [HKWorkout],
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
            ActivityLogPayload(
                userId: userId,
                activityType: activityTypeName(workout),
                startedAt: isoFormatter.string(from: workout.startDate),
                endedAt: isoFormatter.string(from: workout.endDate),
                durationMinutes: workout.duration / 60,
                activeCalories: workout.totalEnergyBurned?
                    .doubleValue(for: .kilocalorie()),
                source: "healthkit",
                externalId: workout.uuid.uuidString,
                sourceBundleId:
                    workout.sourceRevision.source.bundleIdentifier,
                sourceDevice: workout.device?.name,
                timezone: TimeZone.current.identifier,
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
        case .traditionalStrengthTraining:
            return "strength_training"
        case .functionalStrengthTraining:
            return "functional_strength_training"
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
    let source: String
    let externalId: String
    let sourceBundleId: String
    let sourceDevice: String?
    let timezone: String
    let importedAt: String
    let deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case activityType = "activity_type"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case durationMinutes = "duration_minutes"
        case activeCalories = "active_calories"
        case source
        case externalId = "external_id"
        case sourceBundleId = "source_bundle_id"
        case sourceDevice = "source_device"
        case timezone
        case importedAt = "imported_at"
        case deletedAt = "deleted_at"
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
