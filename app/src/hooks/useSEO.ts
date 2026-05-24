import { useEffect } from "react";

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
}

export function useSEO(options: SEOOptions = {}) {
  const {
    title = "Aura Tickets — Plataforma de Ingressos",
    description = "Descubra eventos incríveis e compre ingressos com segurança na Aura Tickets.",
    image = "/og-image.jpg",
    url = typeof window !== "undefined" ? window.location.href : "",
    type = "website",
    noindex = false,
  } = options;

  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        const key = attr === "property" ? "property" : "name";
        el.setAttribute(key, selector.replace(/meta\[name="|meta\[property="|\"/g, ""));
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    setMeta("meta[name=\"description\"]", "name", description);
    setMeta("meta[property=\"og:title\"]", "property", title);
    setMeta("meta[property=\"og:description\"]", "property", description);
    setMeta("meta[property=\"og:image\"]", "property", image);
    setMeta("meta[property=\"og:url\"]", "property", url);
    setMeta("meta[property=\"og:type\"]", "property", type);
    setMeta("meta[name=\"twitter:title\"]", "name", title);
    setMeta("meta[name=\"twitter:description\"]", "name", description);
    setMeta("meta[name=\"twitter:image\"]", "name", image);
    setMeta("meta[name=\"twitter:card\"]", "name", "summary_large_image");

    if (noindex) {
      setMeta("meta[name=\"robots\"]", "name", "noindex, nofollow");
    } else {
      setMeta("meta[name=\"robots\"]", "name", "index, follow");
    }

    return () => {};
  }, [title, description, image, url, type, noindex]);
}
