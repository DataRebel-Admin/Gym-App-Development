/**
 * Video-helper voor eigen oefeningen. Zet een YouTube/Vimeo-link om naar een
 * insluit-URL (`<iframe>`), zodat we de video waar mogelijk direct in de
 * oefeningpagina tonen. Onbekende of niet-ondersteunde URL's geven `null`
 * (de UI valt dan terug op een nette externe link). Géén externe call —
 * puur parsen, EU-data-proof.
 */

export type EmbeddedVideo = {
  provider: "youtube" | "vimeo";
  embedUrl: string;
};

function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

/** Haal het YouTube-video-id uit de gangbare URL-vormen. */
function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(embed|shorts|v)\/([^/?#]+)/);
    if (m) return m[2];
  }
  return null;
}

/** Haal het Vimeo-video-id (numeriek) uit de URL. */
function vimeoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = u.pathname.match(/\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** Zet een video-URL om naar een insluitbare embed-URL, of null. */
export function toEmbedUrl(url: string | null | undefined): EmbeddedVideo | null {
  if (!url) return null;
  const u = parse(url);
  if (!u) return null;
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const yt = youtubeId(u);
  if (yt) return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };

  const vi = vimeoId(u);
  if (vi) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vi}` };

  return null;
}
