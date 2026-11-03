import XCTest

final class FitCraftUITests: XCTestCase {
    @MainActor func testOnboardingAndMainTabs() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
        let name = app.textFields["profileName"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Alex")
        app.buttons["onboardingContinue"].tap()
        app.buttons["onboardingContinue"].tap()
        app.buttons["onboardingContinue"].tap()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Let’s go, Alex."].exists)
        capture(app, name: "Today")
        for tab in ["Train", "Fuel", "Explore", "Records"] {
            app.tabBars.buttons[tab].tap()
            XCTAssertTrue(app.navigationBars[tab].waitForExistence(timeout: 5))
            capture(app, name: tab)
        }
    }

    @MainActor private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
