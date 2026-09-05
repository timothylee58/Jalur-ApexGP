/** Local headshot paths under `public/drivers/`. Fan-page / drivers UI only. */
export const DRIVER_PHOTO: Record<string, string> = {
  norris: "/drivers/norris.png",
  piastri: "/drivers/piastri.png",
  leclerc: "/drivers/leclerc.png",
  hamilton: "/drivers/hamilton.png",
  verstappen: "/drivers/verstappen.png",
  hadjar: "/drivers/hadjar.png",
  russell: "/drivers/russell.png",
  antonelli: "/drivers/antonelli.png",
  alonso: "/drivers/alonso.png",
  stroll: "/drivers/stroll.png",
  gasly: "/drivers/gasly.png",
  colapinto: "/drivers/colapinto.png",
  ocon: "/drivers/ocon.png",
  bearman: "/drivers/bearman.png",
  lawson: "/drivers/lawson.png",
  lindblad: "/drivers/lindblad.png",
  sainz: "/drivers/sainz.png",
  albon: "/drivers/albon.png",
  hulkenberg: "/drivers/hulkenberg.png",
  bortoleto: "/drivers/bortoleto.png",
  perez: "/drivers/perez.png",
  bottas: "/drivers/bottas.png",
  irvine: "/drivers/irvine.jpg",
  schumacher: "/drivers/schumacher.jpg",
  button: "/drivers/button.jpg",
};

export function photoForDriver(driverId: string): string | null {
  return DRIVER_PHOTO[driverId] ?? null;
}
