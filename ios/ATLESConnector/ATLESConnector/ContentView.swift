//
//  ContentView.swift
//  ATLESConnector
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import SwiftUI
import HealthKit

struct ContentView: View {
    @StateObject private var healthKit = HealthKitManager()
    @ObservedObject private var auth = SupabaseAuthManager.shared
    @StateObject private var sync = SupabaseHealthSyncManager()

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Supabase") {
                    if auth.isAuthenticated {
                        Label(
                            "Sessió iniciada",
                            systemImage: "checkmark.circle.fill"
                        )

                        if let userId = auth.userId {
                            Text(userId)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if let userId = auth.userId,
                           let accessToken = auth.accessToken {

                            Button {
                                Task {
                                    await sync.syncTodaySteps(
                                        steps: healthKit.todaySteps,
                                        userId: userId,
                                        accessToken: accessToken
                                    )
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text("Sincronitzar passos")
                                }
                            }

                            Button {
                                Task {
                                    do {
                                        let recent =
                                            try await healthKit.loadRecentStepHistory(
                                                days: 7
                                            )

                                        await sync.syncStepHistory(
                                            metrics: recent,
                                            userId: userId,
                                            accessToken: accessToken
                                        )
                                    } catch {
                                        sync.errorMessage =
                                            error.localizedDescription
                                    }
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text(
                                        "Refrescar últims 7 dies"
                                    )
                                }
                            }
                            .disabled(sync.isSyncing)

                            Button {
                                Task {
                                    do {
                                        let history =
                                            try await healthKit.loadStepHistory()

                                        await sync.syncStepHistory(
                                            metrics: history,
                                            userId: userId,
                                            accessToken: accessToken
                                        )
                                    } catch {
                                        sync.errorMessage =
                                            error.localizedDescription
                                    }
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text(
                                        "Importar historial de passos"
                                    )
                                }
                            }
                            .disabled(sync.isSyncing)

                            Button {
                                Task {
                                    do {
                                        let recent =
                                            try await healthKit.loadRecentDailyHistory(
                                                days: 7
                                            )

                                        await sync.syncDailyMetrics(
                                            metrics: recent,
                                            userId: userId,
                                            accessToken: accessToken
                                        )
                                    } catch {
                                        sync.errorMessage =
                                            error.localizedDescription
                                    }
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text(
                                        "Refrescar totes les mètriques · 7 dies"
                                    )
                                }
                            }
                            .disabled(sync.isSyncing)

                            Button {
                                Task {
                                    do {
                                        let history =
                                            try await healthKit.loadDailyHistory()

                                        await sync.syncDailyMetrics(
                                            metrics: history,
                                            userId: userId,
                                            accessToken: accessToken
                                        )
                                    } catch {
                                        sync.errorMessage =
                                            error.localizedDescription
                                    }
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text(
                                        "Importar historial diari complet"
                                    )
                                }
                            }
                            .disabled(sync.isSyncing)

                            Button {
                                Task {
                                    let metrics =
                                        await healthKit.loadWorkoutMetrics(
                                            for: healthKit.workouts
                                        )

                                    await sync.syncWorkouts(
                                        workouts: healthKit.workouts,
                                        metricsByWorkout: metrics,
                                        userId: userId,
                                        accessToken: accessToken
                                    )
                                }
                            } label: {
                                if sync.isSyncing {
                                    ProgressView()
                                } else {
                                    Text("Sincronitzar entrenaments")
                                }
                            }

                            if let message = sync.syncMessage {
                                Text(message)
                                    .foregroundStyle(.green)
                            }

                            if let error = sync.errorMessage {
                                Text(error)
                                    .foregroundStyle(.red)
                            }
                        }

                        Button("Tancar sessió") {
                            auth.signOut()
                        }
                    } else {
                        TextField("Correu", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()

                        SecureField("Contrasenya", text: $password)

                        Button {
                            Task {
                                await auth.signIn(
                                    email: email,
                                    password: password
                                )
                            }
                        } label: {
                            if auth.isLoading {
                                ProgressView()
                            } else {
                                Text("Iniciar sessió")
                            }
                        }
                        .disabled(
                            email.isEmpty ||
                            password.isEmpty ||
                            auth.isLoading
                        )

                        if let error = auth.errorMessage {
                            Text(error)
                                .foregroundStyle(.red)
                        }
                    }
                }

                Section {
                    Button("Connectar Apple Health") {
                        Task {
                            await healthKit.requestAuthorization()
                        }
                    }
                }

                Section("Passos d’avui") {
                    Text("\(Int(healthKit.todaySteps)) passos")
                        .font(.title2)
                }

                Section("Entrenaments recents") {
                    if healthKit.workouts.isEmpty {
                        Text("Encara no hi ha entrenaments carregats.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(healthKit.workouts, id: \.uuid) { workout in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(workoutName(workout))
                                    .font(.headline)

                                Text(
                                    workout.startDate.formatted(
                                        date: .abbreviated,
                                        time: .shortened
                                    )
                                )
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if let error = healthKit.authorizationError {
                    Section("Error HealthKit") {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("ATLES Health")
        }
        .task {
            await auth.restoreSession()
        }
    }

    private func workoutName(_ workout: HKWorkout) -> String {
        switch workout.workoutActivityType {
        case .running:
            return "Running"
        case .walking:
            return "Caminada"
        case .cycling:
            return "Ciclisme"
        case .traditionalStrengthTraining:
            return "Força"
        case .functionalStrengthTraining:
            return "Força funcional"
        default:
            return "Entrenament"
        }
    }
}

#Preview {
    ContentView()
}
