// Client-side helper: download een bestand via een POST-formulier naar een
// route-handler die een attachment teruggeeft. De body draagt (grote) parameters
// zoals een id-lijst → geen URL-lengtelimiet. Een verborgen iframe vangt de
// respons op zodat de huidige pagina nooit navigeert.

export function postDownload(action: string, fields: Record<string, string>) {
  if (typeof document === "undefined") return;

  const iframeName = `qr-dl-${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.target = iframeName;
  form.style.display = "none";

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();

  // Opruimen nadat de browser de download heeft opgepakt.
  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 60_000);
}
