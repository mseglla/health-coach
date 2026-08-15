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

    var body: some View {
        NavigationStack {
            List {
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
                    Section("Error") {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("ATLES Health")
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
