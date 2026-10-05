# Sky visuals: Orrery worlds and Review Queue stars

How the Orrery's worlds and the Review Queue's pull-request stars are drawn,
which data each mark carries, and how to change one safely. The help cards
(`orrery-help.ts`, `starmap-help/help-content.ts`) say what a mark _means_ in a
line; this page says how it works.

Everything here is the WebGL renderer. Each sky also has a Canvas 2D fallback
for when WebGL can't start or a shader won't compile; the fallback keeps the
older, simpler marks unless a section says otherwise.

## Principle: meaning versus scenery

Every mark is either **data** or **scenery**, and the help cards say which.
Scenery (a world's kind, its land, its clouds, a star's granulation) is chosen
per repo or per star so it stays the same on every load, but it means nothing.
Data marks are each driven by one pure, tested function, so the rule lives in
TypeScript and the shader only draws it.

| Sky          | Mark             | Data                       | Rule (function)                |
| ------------ | ---------------- | -------------------------- | ------------------------------ |
| Orrery       | Air colour       | Most urgent state          | severity colour (`severityOf`) |
| Orrery       | City lights      | Open PRs, oldest idle days | `nightSide(project).lights`    |
| Orrery       | Glowing fissures | Failing checks             | `nightSide(project).unrest`    |
| Orrery       | Ring             | Conflicted branches        | `world.hasRing`                |
| Review Queue | Star type        | Bucket, idle days          | `starLook(star)`               |
| Review Queue | Gas disc         | Lines changed, quick win   | `massOf(star)`                 |
| Review Queue | Planets          | Issues the PR closes       | `issuePlanets(star)`           |
| Review Queue | Size             | Idle days                  | `mag` in `layoutQueue`         |

## Orrery worlds

![The four kinds of world rendered on their own, lit from the front: rocky worlds with clouds and city lights, one with glowing fissures, a cratered desert, an ice world and a ringed gas giant](images/orrery-worlds.png)

Code: `features/orrery/orrery-canvas/webgl/orrery-webgl.ts` builds the scene;
the shaders are in `shared/planets/planet-shaders.ts` (shared with the
Architecture page's star view) and `orrery-shaders.ts` (sun, rings, field).

### The shipped Milky Way (data: merged pull requests)

The band holds every pull request merged in the last 60 days across the projects
on show (`orrery-canvas/shipped-layer.ts`). `ShippedFeed`
(`core/orrery/shipped-feed.ts`) reads each shown project's `/api/ledger` in the
browser, so the server's per-repository access rules apply to each, and drops any
it can't read. `shippedWork` (`core/orrery/shipped.ts`) gathers the merges, newest
first. `placeShipped` runs them along the band from the oldest shown (at least a
week) to today, eased so recent days get more room, spread through their own day
and across the band, densest on its centre line. `milky-way-geometry.ts` holds
the band's direction, offset, turn and parallax for both the shader and
`bandToScreen`, so specks sit in the band and turn with it (the shader's small
noisy wander isn't reproduced, so a speck can sit just off the glow).

Each speck is a near-white core in a faint halo of its project's world colour,
fading in oldest first. A world in front hides it. Hover names it (project,
number, merge date, title); click opens that project's review queue.

### Lanes

`layoutWorlds` sets each orbit from urgency and neglect, then `clearLanes`
pushes any orbit out until it clears the one inside it by both worlds' air
(`AIR_SCALE`) plus 28 units, so worlds never sit on top of each other side by
side. Behind the sun the slant and each orbit's small tilt bring lanes closer,
so a nearer world can still pass in front of a farther one there, like a
transit. A hard guarantee would need the system about twice as wide.

### Kind (scenery)

`worldKind(repo)` in `core/orrery/world-kind.ts` picks **rocky**, **gas giant**,
**ice** or **desert** from bits 11 and up of `hashString(repo)`. The low bits
seed the surface noise, so kind and surface vary independently. A second,
per-repo `vary()` value in the shader picks between two palettes within a kind
(lush or arid rocky, warm or cool gas, grey or rust desert). Lava worlds were
left out on purpose, so no kind reads as an alarm.

Surfaces are computed per pixel from 3D simplex noise (`shared/gl/simplex-glsl.ts`)
with fractal sums and domain warping; no textures load. Rocky worlds get
continents, oceans and ice caps; gas giants warped bands, eddies and a storm;
ice worlds soft blue cracks; deserts two crater fields and grain.

### Light

- **Relief:** the surface normal is tilted down the terrain's slope, measured
  from three height samples, so highlands and crater rims catch the light along
  the terminator. Gas giants have no relief and a softer terminator.
- **Terminator:** sunlight warms toward orange where it grazes the air.
- **Gloss:** water and ice have a specular glint; rock barely does.
- **Grade:** ACES filmic tone mapping (exposure 1.05) for the whole frame.

### Air (data: severity)

A shell at 1.12 × the world's radius. It is densest just above the ground and
thins with altitude, measured from where the view ray passes closest to the
world, so it reads as haze rather than an outline. It is lit on the day side and
warms at the terminator. The surface itself takes only 14% of the severity
colour (`WORLD_TINT`) plus a faint limb haze, so the air is where health reads.

### Clouds (scenery)

A shell at 1.015 × radius on rocky (55% cover), ice (30%) and desert (15%)
worlds; gas giants have none (`CLOUD_COVER`). Clouds turn at 0.05 rad/s, a
little faster than the ground's 0.035. The ground samples the same cloud field,
offset toward the sun and turned by the ground-minus-cloud angle, so cloud
shadows line up with the clouds.

### Night side (data)

`nightSide(project)` in `core/orrery/world-night.ts`:

- **City lights** = `min(open / 10, 1)`, dimmed by up to 80% as
  `oldestIdleDays` reaches 30. No open PRs, no lights. Lights cluster into
  regions on land only (not water, not gas giants) and dim under cloud.
- **Fissures** appear only while `failing > 0`: 0.4 for the first failing
  check, +0.2 for each more, capped at 1, with a slow flicker. On a gas giant
  they show as a smoulder in the bands.

### Rings (data: conflicted branches)

Many thin translucent bands with a gap, dust mixed with the severity colour,
brighter when the sun is behind them (forward scatter), and dark where the
world's shadow crosses them. Moons use the desert surface in the palette's moon
grey with no air, lights or fissures.

### The sky behind (scenery)

A full-screen Milky Way (`milky-way-shader.ts`) is drawn before anything else:
a tilted, wandering band of glow set off the centre, warmer at its core,
split by dark dust lanes, over a haze of faint unresolved stars densest in the
band. In front of it, 1,800 field stars (`starField(1800, 1.7)`) sit far
behind the system in 3D, mostly faint with a few bright ones (brightness falls
off as the cube of an even draw). The whole sky turns at 0.0012 rad/s (about
once in 90 minutes) and shifts slightly with the camera. It stays under the
bloom threshold. There are no shooting stars on purpose: a comet here means
an unclaimed issue, and a shooting star on the review queue a merged PR.

## Review Queue stars

Code: `features/starmap/engine/webgl-sky.ts` builds and updates the stars; the
star shader is `shared/gl/star-shader.ts` (shared with the Architecture page),
and the disc and planet shaders are `engine/star-system-shaders.ts`.

![PR stars rendered on their own, zoomed in: a flaring giant with a gas disc and planets, a clear star with a green quick-win disc, a veiled star with planets, and a large change with a wide disc](images/review-queue-stars.png)

### The sky behind (scenery)

Where the Orrery shows the Milky Way from inside, the review queue shows a
neighbour from outside: a spiral galaxy (`engine/galaxy-shader.ts`) drawn as a
full-screen layer at the far plane, up and to the right, tilted away. It has a
warm core, two bluish arms on a logarithmic spiral with pink star-forming
knots and a dust lane on their inner edge, and a sparse haze of faint stars.
The arms turn at 0.004 rad/s and the layer shifts slightly with the camera;
both hold still when motion is off. The coloured nebula clouds stay, and the
field stars (`buildField`) keep their places and count but now follow the
same power law as the Orrery's: mostly faint, a few bright.

### The Spiral of Done (data: finished work)

The galaxy's arms hold the last 60 days of finished work (`engine/done-layer.ts`).
`doneWork` (`core/queue/done-work.ts`) merges the ledger's merged and
closed-unmerged pull requests with the issues report's closed issues, newest
first. `placeDone` (`engine/done-spiral.ts`) treats each arm as a timeline:
radius runs from 0.22 (today) in to 0.035 (the oldest work shown, or a week
ago if that is sooner), on an eased scale so recent days get more room, with each light on one of the two arms and a small,
stable lean off the arm's centre. `galaxy-geometry.ts` holds the galaxy's
centre, turn, tilt and winding for both the shader and `galaxyToScreen`, so a
light always sits on a drawn arm and turns with it.

Merged pull requests are blue-white, closed-unmerged ones embers, closed issues
gold, and issues closed as not planned grey. On load the lights spiral in from
beyond the tips, oldest first; the newest six things finished in the last day pulse. A
light under the pointer shows its number, title and date; clicking opens the
PR screen or the issue window. The toolbar's **Done** list groups the same
items by day and lights a row's spot on the spiral.

### Layout

`layoutQueue` in `engine/sky-layout.ts` makes each bucket a constellation laid
out as a **spiral arm**: the first PR in queue order at its heart, the rest a
fixed 130 world units apart along the arm, turns 165 apart, with ±18 of
jitter. A crowded bucket grows wider instead of packing tighter.
Constellations sit side by side by their measured width with 240 units
between them, and each label sits under its arm. The camera's Fit frames the
result, so the layout may be wider than `WORLD`.

### Size and brightness (data: idle days)

`mag = 3.5 + min(√idleDays × 2.2, 9.5)`, and drift is `5 + min(idleDays × 0.2, 11)`,
kept well inside the gaps. `starRadius(f, star, grow)` turns `mag` into screen
pixels. **Keep `starRadius` meaning the star's core radius:** the link lines'
gaps (`engine/link-ink.ts`) are measured from it.

### Detail on zoom

Each star is a camera-facing quad (the 3D camera never rotates, so a plane faces
it without billboarding). `detail` rises from 0 to 1 as the on-screen core
grows from 2.5 to 8 px. Far off, a star is a hot core in a soft halo. Close up,
the drawn disc grows from 0.46 to 0.75 of `starRadius`, into the gap the link
lines leave, and shows limb darkening, slowly churning granulation and corona
streamers. Planets fade in with the same `detail`.

### Star type (data: bucket and idle days)

`starLook(star)` in `engine/star-type.ts`:

| Bucket               | Type   | Look                                                                                                    |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| conflicted, failing  | giant  | Deep colour, soft spots, wide corona, flares. Activity is 0.25 on day one, rising to 1 by 14 days idle. |
| unknown              | veiled | Hidden in a drifting veil of its own gas.                                                               |
| unreviewed, unlinked | bright | Clear, whiter core, diffraction spikes.                                                                 |
| fresh                | calm   | Small corona, quiet surface.                                                                            |

A star that stands for no PR (a log fault, an issue) is bright and still. The
blocked pulse ring is unchanged.

### Gas disc (data: lines changed)

`massOf(star)` in `engine/star-system.ts`: none under 20 lines changed
(log10 < 1.3); otherwise reach = `1.5 + 0.75 × log10(lines + 1)` × `starRadius`,
weight = `min(1, log / 3)`, and quick wins use the quick-win green. The disc
starts at 1.3 × the drawn star disc, turns faster near the star, is brighter on
its approaching side, and its far half dims where it passes behind the star. It
shows on the PR chart only. The Canvas fallback draws the same rule as dashed
ellipses; both read `massOf` and `systemTurn`, so they agree.

### Planets (data: linked issues)

`issuePlanets(star)` in `engine/star-system.ts`: one per issue the PR closes, up
to four, orbiting at 1.9, 2.5, 3.1 and 3.7 × `starRadius` in the disc's tilted
plane, the outer ones slower. Each is a small sphere lit by its star, in one of
three tones (rock, dust, water) picked by issue number. No planets means the PR
closes no issue. Planets draw over the star's glow even on the far side,
because the star doesn't write depth; at their size this reads fine.

## Changing a visual

- **Change the rule in TypeScript, not the shader.** A data mark's thresholds
  live in its function, with tests. Update the help-card row when its meaning
  changes.
- **Reduced motion:** when motion is off, the Review Queue passes its shaders a
  fixed `time` and the Orrery stops redrawing, so surfaces, clouds, flares,
  discs and planets hold still. Drive anything new that moves from that same
  `time`.
- **Shader errors fall back to 2D.** `onShaderError` throws and the sky keeps
  the Canvas renderer, so a broken shader shows as "the old look", not a blank
  page. Check the 3D sky actually renders after a change.
- **Verify with a real render.** Unit tests can't compile GLSL. Bundle a small
  page that renders the shader with three.js (esbuild), then screenshot it with
  headless Chrome on SwiftShader:

  ```sh
  chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
    --allow-file-access-from-files --window-size=1600,640 \
    --virtual-time-budget=10000 --screenshot=shot.png file:///…/index.html
  ```

  Use `--dump-dom` with an `onShaderError` hook that writes the info log into
  the page to read compile errors. Match the sky's tone mapping and bloom so
  brightness judgements hold.

- **Cost:** surfaces evaluate many noise octaves per pixel, more on cloudy
  worlds. That's fine at normal sizes; a world filling the screen on an
  integrated GPU may drop frames. Cut octaves in the height function first if
  it does.
