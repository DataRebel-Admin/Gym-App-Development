import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EMAIL_HEADER_STYLE,
  HEADER_CSS_MAX_LENGTH,
  LOGO_WIDTH_MAX,
  LOGO_WIDTH_MIN,
  applyHeaderTokens,
  clampLogoWidth,
  isDefaultHeaderStyle,
  parseHeaderStyle,
  sanitizeHeaderCss,
  sanitizeHeaderStyle,
  serializeHeaderStyle,
} from "../lib/email/header-style";

test("sanitize haalt tekens weg die het style-attribuut zouden breken", () => {
  const css = sanitizeHeaderCss('background:red" onload="alert(1)');
  assert.ok(!css.includes('"'), "geen dubbele aanhalingstekens");

  const html = sanitizeHeaderCss("padding:0<script>alert(1)</script>");
  assert.ok(!html.includes("<") && !html.includes(">"), "geen tag-haken");
});

test("sanitize normaliseert witruimte en begrenst de lengte", () => {
  assert.equal(sanitizeHeaderCss("  padding:0\n   ;margin:0  "), "padding:0 ;margin:0");
  assert.equal(sanitizeHeaderCss("a".repeat(1000)).length, HEADER_CSS_MAX_LENGTH);
});

test("logobreedte wordt geklemd op de breedte van de mailkaart", () => {
  assert.equal(clampLogoWidth(1), LOGO_WIDTH_MIN);
  assert.equal(clampLogoWidth(9999), LOGO_WIDTH_MAX);
  assert.equal(clampLogoWidth(200.4), 200);
  assert.equal(clampLogoWidth(Number.NaN), DEFAULT_EMAIL_HEADER_STYLE.logoWidth);
});

test("tokens houden de balk whitelabel", () => {
  const values = { accentColor: "#000000", accentText: "#ffffff", secondaryColor: "#123456" };
  assert.equal(
    applyHeaderTokens("background:{{accentColor}};color:{{accentText}}", values),
    "background:#000000;color:#ffffff"
  );
  assert.equal(applyHeaderTokens("background:{{ secondaryColor }}", values), "background:#123456");
});

test("een onbekend token wordt leeg, nooit zichtbaar in de mail", () => {
  const out = applyHeaderTokens("background:{{logoUrl}}", {
    accentColor: "#000",
    accentText: "#fff",
    secondaryColor: "#123",
  });
  assert.equal(out, "background:");
  assert.ok(!out.includes("{{"), "geen achtergebleven accolades");
});

test("de standaardbalk volgt het tenant-accent", () => {
  assert.ok(
    DEFAULT_EMAIL_HEADER_STYLE.barCss.includes("{{accentColor}}"),
    "zonder token zou elke gym dezelfde kleur krijgen"
  );
  assert.ok(DEFAULT_EMAIL_HEADER_STYLE.wordmarkCss.includes("{{accentText}}"));
});

test("ontbrekende of kapotte opslag valt terug op de standaard", () => {
  assert.deepEqual(parseHeaderStyle(null), DEFAULT_EMAIL_HEADER_STYLE);
  assert.deepEqual(parseHeaderStyle(""), DEFAULT_EMAIL_HEADER_STYLE);
  assert.deepEqual(parseHeaderStyle("{niet echt json"), DEFAULT_EMAIL_HEADER_STYLE);
  assert.deepEqual(parseHeaderStyle("[]"), DEFAULT_EMAIL_HEADER_STYLE);
});

test("een half ingevuld object wordt aangevuld met de standaard", () => {
  const style = sanitizeHeaderStyle({ barCss: "background:#000" });
  assert.equal(style.barCss, "background:#000");
  assert.equal(style.badgeCss, DEFAULT_EMAIL_HEADER_STYLE.badgeCss);
  assert.equal(style.logoWidth, DEFAULT_EMAIL_HEADER_STYLE.logoWidth);
});

test("opslaan en teruglezen levert dezelfde stijl op", () => {
  const style = sanitizeHeaderStyle({
    barCss: "background:{{secondaryColor}};padding:8px",
    badgeCss: "background:transparent",
    logoCss: "display:block",
    wordmarkCss: "color:{{accentText}}",
    logoWidth: 220,
  });
  assert.deepEqual(parseHeaderStyle(serializeHeaderStyle(style)), style);
});

test("isDefaultHeaderStyle herkent de standaard en een aanpassing", () => {
  assert.equal(isDefaultHeaderStyle(DEFAULT_EMAIL_HEADER_STYLE), true);
  assert.equal(
    isDefaultHeaderStyle({ ...DEFAULT_EMAIL_HEADER_STYLE, logoWidth: 200 }),
    false
  );
});
