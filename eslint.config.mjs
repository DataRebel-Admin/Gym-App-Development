import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Underscore-conventie: bewust ongebruikte (bv. door useActionState
      // vereiste) parameters heten `_prev`/`_formData` en zijn geen ruis.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gradle-output: `cap sync` kopieert hier o.a. Capacitor's native-bridge.js
    // naartoe. Gegenereerd, tweemaal (debug + release), en niet te repareren —
    // een volgende sync zet het toch terug. 16 van de waarschuwingen kwamen
    // hiervandaan en verdrongen de meldingen over onze eigen code.
    "android/**/build/**",
  ]),
]);

export default eslintConfig;
