# Brand My Tesla

Auction site for vinyl ad placements on Robert Scoble's white 2018 Tesla Model 3.
Static site, no build step. Open `index.html` or serve the folder.

## How the car renderings work

The old site asked an image generator to draw logos on the car, which produced garbled text and
misplaced boxes. This version uses six clean studio photos of the car and maps logos onto the
panels with code:

- `cars/*.jpg` are the base photos (1792 x 1008). Passenger side is the driver side photo mirrored.
- `quads.js` holds, for each view, every placement's four corners `c` plus its curvature: `bow` bends
  each edge midpoint over the panel and `wrap` compresses the far ends like vinyl over a cylinder.
- `app.js` builds a curved mesh from that (homography for the corners, then bow and wrap on top) and
  draws the logo through it triangle by triangle on a canvas, so text baselines arc over the hood
  crown, bumper corners, and trunk lid instead of sitting like a flat sticker. The canvas uses
  `mix-blend-mode: multiply` so the paint's shading and reflections show through like real vinyl.
- Uploaded logos are cleaned first: a flat background is cut away, and a dark background is inverted so
  the mark reads as dark vinyl on white paint. Turn that off with the checkbox under the upload button.

### Adjusting a placement

Open the site with `?calib=1`. White handles are corners, blue handles are edge midpoints (drag them to
bend an edge). The JSON for the current view appears in a box at the bottom of the page. Paste it into
`quads.js`. `wrap` angles are edited by hand.

Or run `python3 calib.py out-dir` (needs Pillow and numpy) to render full size composites with a grid
so you can read coordinates off them.

### Handy URL params

- `?view=rear34` opens on a given angle: `front34`, `front`, `side-l`, `side-r`, `rear34`, `rear`
- `?spot=trunk` preselects a spot: `hood`, `trunk`, `door-fl`, `door-fr`, `door-rl`, `door-rr`, `bumper-f`, `bumper-r`
- `?text=ACME` previews a brand name on every open spot
- `?logo=cars/some-file.png` previews a same origin logo file from a link
- `?nodemo=1` hides the example brand marks and shows plain outlines on open spots
- `?shot=1` hides everything except the car viewer (useful for screenshots and embeds)

## Bids

Bids are stored in the visitor's browser (`localStorage`) for now, so this is a working demo of the
flow, not a shared live auction. To make it real, replace the `store` object at the top of `app.js`
with calls to a backend (Firestore, Supabase, or a small API) and add a payment step for the deposit.

## Spots and floors

| Spot | Size | Floor |
| --- | --- | --- |
| Hood | 60 x 20 cm | $1,000 |
| Trunk lid | 50 x 15 cm | $1,000 |
| Driver door, Passenger door | 60 x 30 cm | $750 |
| Front bumper, Rear bumper | 60 x 15 cm | $750 |
| Driver rear door, Passenger rear door | 45 x 22 cm | $500 |

Edit the `SPOTS` array in `app.js` to change names, sizes, or floors. The auction close time is
`CLOSES_AT` in the same file.
