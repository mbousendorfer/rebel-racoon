// Image Generator — ids. Prefixed per entity (br_, st_, pr_, cp_, cr_, as_, ly_, va_)
// so a stray id in the console says what it is.

let counter = 0;

export function uid(prefix) {
  counter = (counter + 1) % 1296;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 46656).toString(36);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}
