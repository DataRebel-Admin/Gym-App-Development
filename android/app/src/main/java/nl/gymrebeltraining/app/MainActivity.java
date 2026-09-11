package nl.gymrebeltraining.app;

import android.os.Bundle;
import android.webkit.WebSettings;

import androidx.activity.EdgeToEdge;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigen plugins registreren vóór super.onCreate, anders kent de bridge ze niet.
        registerPlugin(AppLockPlugin.class);
        registerPlugin(WorkoutNotificationsPlugin.class);
        registerPlugin(CalendarSyncPlugin.class);
        super.onCreate(savedInstanceState);

        // Edge-to-edge op élke Android-versie, niet alleen op 15+ (waar targetSdk
        // 36 het afdwingt). Op 14 en lager tekende de WebView wél onder de
        // statusbalk (de status-bar-plugin zet standaard overlaysWebView) maar niet
        // onder de navigatiebalk, dus onderin bleef een dichte balk in de
        // systeemkleur staan: wit onder een donkere app. Nu is het overal gelijk:
        // beide balken doorzichtig, Capacitor's SystemBars geeft de insets door
        // aan de WebView (viewport-fit=cover) en de web-app houdt de ruimte vrij
        // met env(safe-area-inset-*); zie "Statusbalk & safe areas" in CLAUDE.md.
        // Bij 3-knopsnavigatie tekent Android zelf een scrim achter de knoppen;
        // de icoonkleur van beide balken zet de web-app per thema (SystemBarsSync).
        // Ná super.onCreate, zodat dit het laatste woord heeft na de plugins die
        // bij het laden de balken al instellen.
        //
        // Werkt alleen zolang `launchFadeOutDuration` in capacitor.config.ts op 0
        // staat: anders zet core-splashscreen bij het wegklikken van het
        // startscherm de balkkleuren terug naar het thema en is de navigatiebalk
        // weer dicht.
        EdgeToEdge.enable(this);

        // Passkeys (WebAuthn) in de WebView. Anders dan Chrome ondersteunt een
        // Android-WebView navigator.credentials niet vanzelf: de app moet dit
        // expliciet aanzetten, en het toestel moet een WebView met M118+ hebben
        // (de feature-check dekt dat af — op oudere WebViews gebeurt er niets en
        // verbergt de loginknop zichzelf, zoals in elke browser zonder WebAuthn).
        // FOR_APP betekent: alleen voor origins die via Digital Asset Links aan
        // deze app gekoppeld zijn (assetlinks.json met get_login_creds, zie
        // app/.well-known/assetlinks.json/route.ts). Zonder die koppeling of
        // zonder ANDROID_CERT_FINGERPRINTS blijft de ceremonie geweigerd.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettings settings = getBridge().getWebView().getSettings();
            WebSettingsCompat.setWebAuthenticationSupport(
                settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
        }
    }
}
