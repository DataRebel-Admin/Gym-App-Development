import Foundation
import Capacitor
import UserNotifications

/**
 * iOS-tegenhanger van
 * android/app/src/main/java/nl/gymrebeltraining/app/WorkoutNotificationsPlugin.java.
 * Web-kant: lib/workout-notifications.ts.
 *
 * ## Waarom dit bestand hier staat en niet in `ios/`
 *
 * `ios/` wordt gegenereerd door `npx cap add ios` en is wegwerpbaar; alles wat
 * daar met de hand in wordt gezet, is weg zodra iemand de map opnieuw aanmaakt
 * (zelfde reden als scripts/patch-ios-plist.mjs). `npm run ios:plugins` kopieert
 * dit bestand naar ios/App/App/. Het één keer in Xcode aan het target toevoegen
 * blijft handwerk: Xcode compileert alleen wat in project.pbxproj staat, en dat
 * bestand automatisch patchen is fragieler dan die ene sleepbeweging.
 *
 * NIET GETEST OP ECHTE HARDWARE. `ios/` staat niet in de repo en is niet op
 * Windows te genereren (Xcode is macOS-only), dus dit is voorbereid werk dat bij
 * de eerste Mac-build gecontroleerd moet worden — net als de EventKit-kant van
 * de agendasync. De Capacitor-haken hieronder zijn wel geverifieerd tegen de
 * Swift-bron in node_modules/@capacitor/ios.
 *
 * ## Verschillen met Android
 *
 * 1. **Acties horen bij een categorie, niet bij een melding.** Op Android bouw
 *    je de knoppen per melding; op iOS registreer je een UNNotificationCategory
 *    en verwijst de melding daarnaar. De labels komen uit de web-kant (next-intl
 *    kent de UI-taal, Swift niet), dus de categorie wordt bij elke inplanning
 *    opnieuw gezet. Dat is idempotent.
 * 2. **Vooruit plannen is betrouwbaarder.** UNTimeIntervalNotificationTrigger
 *    wordt door het systeem bewaard, dus anders dan de Handler.postDelayed op
 *    Android overleeft de melding het afsluiten van de app.
 * 3. **Er is geen blijvende melding.** iOS kent geen ongoing notification met
 *    chronometer; het equivalent is een Live Activity (ActivityKit), en dat is
 *    een aparte widget-extensie in Xcode. `showOngoing` is daarom bewust een
 *    no-op, zie daar.
 *
 * ## Apple Watch
 *
 * Een gekoppelde Apple Watch spiegelt meldingen van de iPhone zodra die
 * vergrendeld is of niet actief gebruikt wordt; er is geen watch-app voor nodig.
 * Een actie **zonder** `.foreground` handelt de watch ter plekke af, dus de
 * rust verlengen kan met de telefoon in je tas. Zet die optie er dus niet bij:
 * met `.foreground` verandert de knop in "open op je iPhone", precies wat we
 * op een horloge willen vermijden (spiegelt setShowsUserInterface(false) op
 * Android).
 */
@objc(WorkoutNotificationsPlugin)
public class WorkoutNotificationsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WorkoutNotificationsPlugin"
    public let jsName = "WorkoutNotifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showOngoing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearOngoing", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleRestDone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelRestDone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumePendingActions", returnType: CAPPluginReturnPromise)
    ]

    static let categoryId = "GYMREBEL_REST_DONE"
    static let actionExtend = "GYMREBEL_REST_EXTEND"
    static let actionDone = "GYMREBEL_REST_DONE_ACTION"
    static let requestId = "gymrebel-rest-done"

    /// MOET gelijk blijven aan WATCH_EXTEND_SECONDS in lib/workout-notifications.ts
    /// en EXTEND_SECONDS in de Android-plugin.
    static let extendSeconds = 30

    private static let pendingKey = "gymrebel.workout.pendingRestActions"

    private let notificationHandler = WorkoutNotificationsHandler()

    override public func load() {
        // De lókale tak van de router. @capacitor/push-notifications zit op
        // pushNotificationHandler, dus die twee bijten elkaar niet. Zou
        // @capacitor/local-notifications ooit worden toegevoegd, dan claimt die
        // dezelfde slot en verliest een van beide zijn acties.
        bridge?.notificationRouter.localNotificationHandler = notificationHandler
        notificationHandler.plugin = self
    }

    // MARK: - Blijvende melding

    /**
     * No-op op iOS. Er bestaat geen melding die blijft staan met een meelopende
     * teller; het equivalent is een Live Activity (ActivityKit), en dat vraagt
     * een aparte widget-extensie plus een eigen SwiftUI-layout. Bewust niet
     * gebouwd: de web-kant toont de lopende training al in de app zelf
     * (components/member/active-workout-bar.tsx) en op de Apple Watch levert
     * een Live Activity vooral waarde in de Smart Stack, wat losstaat van de
     * meldingen die deze ronde beslaat.
     *
     * Resolvet stil, zodat de web-kant niets hoeft te weten van het platform.
     */
    @objc func showOngoing(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func clearOngoing(_ call: CAPPluginCall) {
        call.resolve()
    }

    // MARK: - Rusttimer

    @objc func scheduleRestDone(_ call: CAPPluginCall) {
        let inMs = call.getInt("inMs") ?? 0
        let title = call.getString("title") ?? "Rust voorbij"
        let body = call.getString("body") ?? ""
        let extendLabel = call.getString("extendLabel") ?? ""
        let doneLabel = call.getString("doneLabel") ?? ""

        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.requestId])

        guard inMs > 0 else {
            call.resolve()
            return
        }

        registerCategory(extendLabel: extendLabel, doneLabel: doneLabel) {
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            // Zonder categorie geen knoppen, ook niet op de watch.
            if !extendLabel.isEmpty || !doneLabel.isEmpty {
                content.categoryIdentifier = Self.categoryId
            }
            // Time Sensitive mag door Focus/Niet storen heen, het iOS-equivalent
            // van CATEGORY_ALARM op Android. Vereist de entitlement
            // com.apple.developer.usernotifications.time-sensitive; zonder die
            // capability negeert iOS dit stil en gedraagt de melding zich gewoon.
            if #available(iOS 15.0, *) {
                content.interruptionLevel = .timeSensitive
            }

            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: max(1, Double(inMs) / 1000.0),
                repeats: false
            )
            let request = UNNotificationRequest(
                identifier: Self.requestId, content: content, trigger: trigger)
            center.add(request) { _ in
                call.resolve()
            }
        }
    }

    @objc func cancelRestDone(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.requestId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.requestId])
        call.resolve()
    }

    /**
     * Zet de categorie met de knoplabels van dit moment. Bestaande categorieën
     * van andere plugins blijven staan: setNotificationCategories vervangt de
     * hele set, dus die wordt eerst opgehaald en samengevoegd.
     */
    private func registerCategory(
        extendLabel: String, doneLabel: String, completion: @escaping () -> Void
    ) {
        let center = UNUserNotificationCenter.current()
        center.getNotificationCategories { existing in
            var actions: [UNNotificationAction] = []
            if !extendLabel.isEmpty {
                actions.append(UNNotificationAction(
                    identifier: Self.actionExtend,
                    title: extendLabel,
                    // Bewust lege opties: géén .foreground. Zie de klasse-uitleg
                    // over de Apple Watch.
                    options: []))
            }
            if !doneLabel.isEmpty {
                actions.append(UNNotificationAction(
                    identifier: Self.actionDone,
                    title: doneLabel,
                    options: []))
            }

            let category = UNNotificationCategory(
                identifier: Self.categoryId,
                actions: actions,
                intentIdentifiers: [],
                options: [])

            var merged = existing.filter { $0.identifier != Self.categoryId }
            merged.insert(category)
            center.setNotificationCategories(merged)
            completion()
        }
    }

    // MARK: - Actie-wachtrij

    /**
     * Legt een getikte knop vast en seint de WebView in als die draait. Zelfde
     * afspraak als op Android: het event draagt géén gegevens, de wachtrij is de
     * bron van waarheid, zodat een actie nooit dubbel wordt toegepast.
     */
    func recordAction(type: String, seconds: Int) {
        let defaults = UserDefaults.standard
        var queue = defaults.array(forKey: Self.pendingKey) as? [[String: Any]] ?? []
        queue.append([
            "type": type,
            "seconds": seconds,
            // Milliseconden sinds epoch, gelijk aan System.currentTimeMillis().
            "at": Int(Date().timeIntervalSince1970 * 1000)
        ])
        defaults.set(queue, forKey: Self.pendingKey)
        notifyListeners("restAction", data: [:])
    }

    @objc func consumePendingActions(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let queue = defaults.array(forKey: Self.pendingKey) as? [[String: Any]] ?? []
        defaults.removeObject(forKey: Self.pendingKey)
        call.resolve(["actions": queue])
    }

    /// Verlengen wordt hier afgehandeld: de melding is al geweest, dus er wordt
    /// een nieuwe ingepland met dezelfde teksten en knoppen.
    func handleExtend(from response: UNNotificationResponse) {
        let content = response.notification.request.content
        let center = UNUserNotificationCenter.current()

        let next = UNMutableNotificationContent()
        next.title = content.title
        next.body = content.body
        next.sound = .default
        next.categoryIdentifier = content.categoryIdentifier
        if #available(iOS 15.0, *) {
            next.interruptionLevel = .timeSensitive
        }

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: Double(Self.extendSeconds), repeats: false)
        center.add(UNNotificationRequest(
            identifier: Self.requestId, content: next, trigger: trigger))

        recordAction(type: "extend", seconds: Self.extendSeconds)
    }
}

/**
 * De haak waarmee Capacitor lokale meldingen doorgeeft. Apart van de plugin,
 * omdat NotificationRouter zijn handlers `weak` vasthoudt en dit het patroon is
 * dat @capacitor/push-notifications ook gebruikt.
 */
class WorkoutNotificationsHandler: NSObject, NotificationHandlerProtocol {
    weak var plugin: WorkoutNotificationsPlugin?

    func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        guard notification.request.identifier == WorkoutNotificationsPlugin.requestId else {
            return []
        }
        // Komt normaal niet voor: staat de app op de voorgrond, dan annuleert de
        // web-kant deze melding zodra de timer in beeld afloopt. Gebeurt dat toch
        // niet, dan is een melding te veel beter dan een gemiste rusttimer.
        if #available(iOS 14.0, *) {
            return [.banner, .sound]
        }
        return [.alert, .sound]
    }

    func didReceive(response: UNNotificationResponse) {
        guard let plugin,
              response.notification.request.identifier == WorkoutNotificationsPlugin.requestId
        else { return }

        switch response.actionIdentifier {
        case WorkoutNotificationsPlugin.actionExtend:
            plugin.handleExtend(from: response)
        case WorkoutNotificationsPlugin.actionDone:
            UNUserNotificationCenter.current().removeDeliveredNotifications(
                withIdentifiers: [WorkoutNotificationsPlugin.requestId])
            plugin.recordAction(type: "done", seconds: 0)
        default:
            // Op de melding zelf getikt (of weggeveegd): de app opent en de
            // web-kant pakt de timer op waar die stond. Niets vast te leggen.
            break
        }
    }
}
