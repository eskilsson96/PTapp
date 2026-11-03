import SwiftUI

enum FC {
    static let lime = Color(red: 0.76, green: 0.96, blue: 0.31)
    static let background = Color(red: 0.045, green: 0.065, blue: 0.06)
    static let card = Color(red: 0.10, green: 0.13, blue: 0.12)
    static let muted = Color(red: 0.67, green: 0.73, blue: 0.69)
}

struct Card<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 16) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(FC.card, in: RoundedRectangle(cornerRadius: 24))
    }
}

struct SectionTitle: View {
    let title: String
    var subtitle: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.title2.bold())
            if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(FC.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Metric: View {
    let value: String
    let label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(value).font(.system(.title, design: .rounded, weight: .bold)).monospacedDigit().minimumScaleFactor(0.6)
            Text(label.uppercased()).font(.caption2.bold()).tracking(1).foregroundStyle(FC.muted)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PrimaryButton: View {
    let title: String
    var symbol: String = "arrow.right"
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol).font(.headline)
                .frame(maxWidth: .infinity).padding(16)
                .foregroundStyle(.black).background(FC.lime, in: RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain)
    }
}

extension View {
    func fitCraftScreen() -> some View {
        self.background(FC.background).toolbarBackground(FC.background, for: .navigationBar)
    }
}

enum Display {
    static func duration(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "—" }
        let value = Int(seconds)
        return String(format: "%02d:%02d", value / 60, value % 60)
    }
    static func pace(distance: Double, seconds: Double) -> String {
        distance >= 20 && seconds > 0 ? duration(seconds / (distance / 1_000)) : "—"
    }
}
