//
//  SupabaseAuthManager.swift
//  ATLESConnector
//
//  Created by Marc Segura Lladó on 15/08/2026.
//

import Foundation
import Combine

@MainActor
final class SupabaseAuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userId: String?
    @Published var errorMessage: String?
    @Published var isLoading = false

    private let supabaseURL = "https://zyjzyyudftnmfjbseibi.supabase.co"
    private let publishableKey = "sb_publishable_IboCUET8TK_jL3TjcX1K5g_z7cZBnN0"

    @Published private(set) var accessToken: String?

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil

        defer {
            isLoading = false
        }

        guard let url = URL(
            string: "\(supabaseURL)/auth/v1/token?grant_type=password"
        ) else {
            errorMessage = "URL de Supabase no vàlida."
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )

        do {
            request.httpBody = try JSONEncoder().encode(
                SignInRequest(
                    email: email.trimmingCharacters(
                        in: .whitespacesAndNewlines
                    ),
                    password: password
                )
            )

            let (data, response) = try await URLSession.shared.data(
                for: request
            )

            guard let httpResponse = response as? HTTPURLResponse else {
                errorMessage = "Resposta no vàlida de Supabase."
                return
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                if let apiError = try? JSONDecoder().decode(
                    SupabaseErrorResponse.self,
                    from: data
                ) {
                    errorMessage = apiError.msg
                        ?? apiError.message
                        ?? "No s'ha pogut iniciar sessió."
                } else {
                    errorMessage = "No s'ha pogut iniciar sessió."
                }

                return
            }

            let session = try JSONDecoder().decode(
                SignInResponse.self,
                from: data
            )

            accessToken = session.accessToken
            userId = session.user.id
            isAuthenticated = true

            try KeychainStore.save(
                session.accessToken,
                account: "supabase_access_token"
            )

            try KeychainStore.save(
                session.refreshToken,
                account: "supabase_refresh_token"
            )

            try KeychainStore.save(
                session.user.id,
                account: "supabase_user_id"
            )

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func restoreSession() async {
        errorMessage = nil

        do {
            guard let refreshToken = try KeychainStore.load(
                account: "supabase_refresh_token"
            ) else {
                return
            }

            try await refreshSession(
                refreshToken: refreshToken
            )

        } catch {
            signOut()
            errorMessage = error.localizedDescription
        }
    }

    private func refreshSession(
        refreshToken: String
    ) async throws {
        guard let url = URL(
            string: "\(supabaseURL)/auth/v1/token?grant_type=refresh_token"
        ) else {
            throw AuthError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            publishableKey,
            forHTTPHeaderField: "apikey"
        )
        request.setValue(
            "application/json",
            forHTTPHeaderField: "Content-Type"
        )

        request.httpBody = try JSONEncoder().encode(
            RefreshRequest(
                refreshToken: refreshToken
            )
        )

        let (data, response) = try await URLSession.shared.data(
            for: request
        )

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode)
        else {
            throw AuthError.refreshFailed
        }

        let session = try JSONDecoder().decode(
            SignInResponse.self,
            from: data
        )

        accessToken = session.accessToken
        userId = session.user.id
        isAuthenticated = true

        try KeychainStore.save(
            session.accessToken,
            account: "supabase_access_token"
        )

        try KeychainStore.save(
            session.refreshToken,
            account: "supabase_refresh_token"
        )

        try KeychainStore.save(
            session.user.id,
            account: "supabase_user_id"
        )
    }

    func signOut() {
        accessToken = nil
        userId = nil
        isAuthenticated = false
        errorMessage = nil

        KeychainStore.delete(account: "supabase_access_token")
        KeychainStore.delete(account: "supabase_refresh_token")
        KeychainStore.delete(account: "supabase_user_id")
    }
}

private struct SignInRequest: Encodable {
    let email: String
    let password: String
}

private struct SignInResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let user: SupabaseUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

private struct SupabaseUser: Decodable {
    let id: String
}

private struct SupabaseErrorResponse: Decodable {
    let msg: String?
    let message: String?
}


private struct RefreshRequest: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private enum AuthError: Error {
    case invalidURL
    case refreshFailed
}
