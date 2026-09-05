// Image-space vinyl safe areas, calibrated against the supplied 1792 × 1008 renderings.
// Corners read TL, TR, BR, BL; bow is [top, right, bottom, left] edge displacement.
// Keep marks inside painted panels, clear of handles, badges, lamps and panel seams.
// These are illustrative projections; installation dimensions require the actual vehicle.
const BMT_QUADS = {
  "front34": {
    "hood": {"c": [[607,463],[857,458],[662,529],[456,524]], "bow": [[0,-3],[3,-2],[0,5],[-3,-2]], "wrap": [12,18]},
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
    // Rear three-quarter: keep the trunk logo above the lid break, and keep both door marks
    // inside the painted door skins, clear of handles, glass and the wheel arch.
    "trunk": {"c": [[365,451],[646,457],[637,522],[366,520]], "bow": [[0,-2],[1,0],[0,2],[-1,0]], "wrap": [6,3]},
    "bumper-r": {"c": [[352,602],[655,611],[657,668],[350,659]], "bow": [[0,-3],[1,0],[0,3],[-1,0]], "wrap": [7,2]},
    "door-rl": {"c": [[1080,478],[1250,487],[1246,598],[1097,594]], "bow": [[0,-1],[1,0],[0,2],[1,0]], "wrap": [4,3]},
    "door-fl": {"c": [[1260,482],[1432,491],[1422,601],[1260,605]], "bow": [[0,-1],[1,0],[0,2],[-1,0]], "wrap": [3,3]}
  },
  "rear": {
    "trunk": {"c": [[694,437],[1098,437],[1093,518],[699,518]], "bow": [[0,-3],[1,0],[0,2],[-1,0]], "wrap": [10,4]},
    "bumper-r": {"c": [[729,623],[1073,623],[1078,676],[724,676]], "bow": [[0,-3],[2,0],[0,-2],[-2,0]], "wrap": [14,4]}
  }
};
