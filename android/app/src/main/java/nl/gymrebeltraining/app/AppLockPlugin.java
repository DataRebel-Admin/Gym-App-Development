package nl.gymrebeltraining.app;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * App-vergrendeling met de toestel-biometrie (vingerafdruk/gezicht), met de
 * schermvergrendeling (pincode/patroon) als terugval. Bewust een lokale plugin
 * en géén passkey/credential-manager-route: die laag bleek op sommige
 * toestellen (derde-partij wachtwoordmanagers) onbetrouwbaar, terwijl
 * BiometricPrompt de kale, bankwaardige ontgrendel-overlay is.
 *
 * Web-kant: lib/app-lock.ts (registerPlugin("AppLock")).
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
    /** Vingerafdruk/gezicht, en de toestel-pincode als terugval (natte handen). */
    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_WEAK
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        boolean available =
            manager.canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject result = new JSObject();
        result.put("available", available);
        call.resolve(result);
    }

    @PluginMethod
    public void verify(PluginCall call) {
        String title = call.getString("title", "Ontgrendelen");
        String subtitle = call.getString("subtitle", "");

        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("no_activity");
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(activity);
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject out = new JSObject();
                        out.put("verified", true);
                        call.resolve(out);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        // Geannuleerd, te vaak geprobeerd, of hardwarefout: de
                        // web-laag toont dan het vergrendelscherm met "opnieuw".
                        JSObject out = new JSObject();
                        out.put("verified", false);
                        out.put("code", errorCode);
                        call.resolve(out);
                    }

                    // onAuthenticationFailed (één mislukte scan) bewust niet
                    // afgehandeld: de systeemprompt blijft dan gewoon staan
                    // voor een nieuwe poging.
                });

            BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                // Let op: met DEVICE_CREDENTIAL mag er géén negative button zijn.
                .setAllowedAuthenticators(AUTHENTICATORS);
            if (subtitle != null && !subtitle.isEmpty()) {
                builder.setSubtitle(subtitle);
            }
            prompt.authenticate(builder.build());
        });
    }
}
