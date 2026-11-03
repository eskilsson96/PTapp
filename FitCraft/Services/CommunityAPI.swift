import Foundation

struct GroceryOffer: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let store: String
    let price: Double
    let currency: String
    let validUntil: Date
}

struct RemoteRanking: Codable, Identifiable, Sendable {
    let id: UUID
    let athleteID: UUID
    let attemptID: UUID
    let displayName: String
    let elapsedSeconds: Double
    let achievedAt: Date
    let rank: Int
}

/// Optional public read API. Production submission needs authentication and validation.
struct CommunityAPI: Sendable {
    let baseURL: URL

    func offers() async throws -> [GroceryOffer] {
        let offers: [GroceryOffer] = try await get(path: "offers", query: [])
        guard Set(offers.map(\.id)).count == offers.count else { throw APIError.invalidResponse }
        return offers.filter { $0.validUntil > .now && $0.price.isFinite && $0.price >= 0 }
    }

    func leaderboard(segmentID: UUID, monthly: Bool) async throws -> [RemoteRanking] {
        let rows: [RemoteRanking] = try await get(path: "segments/\(segmentID.uuidString)/leaderboard", query: [URLQueryItem(name: "period", value: monthly ? "monthly" : "allTime")])
        guard rows.count <= 10, Set(rows.map(\.id)).count == rows.count,
              Set(rows.map(\.rank)).count == rows.count,
              Set(rows.map(\.athleteID)).count == rows.count,
              rows.allSatisfy({ $0.elapsedSeconds.isFinite && $0.elapsedSeconds > 0 && (1...10).contains($0.rank) }) else { throw APIError.invalidResponse }
        return rows.sorted { $0.rank < $1.rank }
    }

    private func get<T: Decodable & Sendable>(path: String, query: [URLQueryItem]) async throws -> T {
        guard baseURL.scheme == "https", baseURL.host != nil, baseURL.user == nil, baseURL.password == nil else { throw APIError.invalidURL }
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode), data.count <= 2_000_000 else { throw APIError.invalidResponse }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }

    enum APIError: LocalizedError {
        case invalidURL, invalidResponse
        var errorDescription: String? {
            switch self {
            case .invalidURL: "Enter a valid HTTPS service URL without credentials."
            case .invalidResponse: "The service returned an invalid response."
            }
        }
    }
}
