// Image Generator — the dominant colours of an uploaded reference image, read
// once at upload (a 24×24 downsample, bucketed). A custom style blends them
// into the brand palette by the reference's weight — the mock's stand-in for
// "learn the look of these images".

function toHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export async function sampleColors(blobOrUrl, count = 3) {
  const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const key = [data[i] >> 5, data[i + 1] >> 5, data[i + 2] >> 5].join(",");
      const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      b.n += 1;
      b.r += data[i];
      b.g += data[i + 1];
      b.b += data[i + 2];
      buckets.set(key, b);
    }
    return [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, count)
      .map((b) => toHex(b.r / b.n, b.g / b.n, b.b / b.n));
  } catch {
    return [];
  } finally {
    if (typeof blobOrUrl !== "string") URL.revokeObjectURL(url);
  }
}
