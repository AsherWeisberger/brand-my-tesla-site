// Image-space vinyl safe areas, calibrated against the supplied 1792 × 1008 renderings.
// Corners read TL, TR, BR, BL; bow is [top, right, bottom, left] edge displacement.
// Keep marks inside painted panels, clear of handles, badges, lamps and panel seams.
// These are illustrative projections; installation dimensions require the actual vehicle.
const BMT_QUADS = {
  "front34": {
    // Center the artwork on the projected windshield-midpoint → hood-badge axis.
    // Both transverse edges follow the hood rather than the horizontal image axis.
    "hood": {"c": [[523,465],[777,473],[663,519],[421,505]], "bow": [[0,-2],[1,-1],[0,2],[-1,-1]], "wrap": [8,10]},
    "door-fr": {"c": [[1030,518],[1187,506],[1187,596],[1033,625]], "bow": [[0,-2],[2,0],[0,3],[-1,0]], "wrap": [8,5]},
    "door-rr": {"c": [[1230,502],[1328,488],[1307,570],[1227,586]], "bow": [[0,-1],[2,0],[0,2],[-1,0]], "wrap": [10,5]},
    "bumper-f": {"c": [[387,599],[533,601],[533,641],[387,635]], "bow": [[0,-2],[1,0],[0,2],[-2,0]], "wrap": [22,5]}
  },
  "front": {
    "hood": {"c": [[703,447],[1089,447],[1050,529],[742,529]], "bow": [[0,-4],[2,-1],[0,4],[-2,-1]], "wrap": [16,14]},
    "bumper-f": {"c": [[723,610],[1041,610],[1045,660],[719,660]], "bow": [[0,-5],[1,0],[0,-3],[-1,0]], "wrap": [18,4]}
  },
  "side-l": {
    "door-fl": {"c": [[620,529],[929,516],[929,640],[622,650]], "bow": [[0,-1],[1,0],[0,2],[-1,0]], "wrap": [4,6]},
    "door-rl": {"c": [[995,526],[1205,517],[1177,613],[996,627]], "bow": [[0,-1],[2,0],[0,2],[-1,0]], "wrap": [6,5]}
  },
  "rear34": {
    // Trunk decal lies on the horizontal deck between the rear glass and trailing lip.
    // Its shallow projected height follows the deck plane, not the vertical license-plate recess.
    // Keep both door marks
    // inside the painted door skins, clear of handles, glass and the wheel arch.
    "trunk": {"c": [[484,374],[716,373],[671,396],[418,392]], "bow": [[0,-1],[0,0],[0,-1],[0,0]], "wrap": [4,2]},
    "bumper-r": {"c": [[352,602],[655,611],[657,668],[350,659]], "bow": [[0,-3],[1,0],[0,3],[-1,0]], "wrap": [7,2]},
    "door-rl": {"c": [[1080,478],[1250,487],[1246,598],[1097,594]], "bow": [[0,-1],[1,0],[0,2],[1,0]], "wrap": [4,3]},
    "door-fl": {"c": [[1260,482],[1432,491],[1422,601],[1260,605]], "bow": [[0,-1],[1,0],[0,2],[-1,0]], "wrap": [3,3]}
  },
  "rear": {
    "trunk": {"c": [[715,245],[1080,245],[1105,265],[690,265]], "bow": [[0,-1],[0,0],[0,-1],[0,0]], "wrap": [4,2]},
    "bumper-r": {"c": [[729,623],[1073,623],[1078,676],[724,676]], "bow": [[0,-3],[2,0],[0,-2],[-2,0]], "wrap": [14,4]}
  }
};
