package nl.gymrebeltraining.app;

import android.os.Bundle;
import android.webkit.WebSettings;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigen plugins registreren vóór super.onCreate, anders kent de bridge ze niet.
        registerPlugin(AppLockPlugin.class);
        super.onCreate(savedInstanceState);

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
