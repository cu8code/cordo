import anime, { type AnimeTimelineInstance } from 'animejs';
import type { SessionData } from "~components/SessionLoader";
import type { CustomTimeline } from "./App";
import { PerspectiveCamera } from "three";

interface Effect {
  type: 'zoom' | 'track';
  start: number;
  end: number;
  data: ZoomData | TrackData;
}

interface ZoomData {
  start: number;
  end: number;
  target: {
    x: number;
    y: number;
  };
}

interface TrackData {
  start: number;
  end: number;
  points: Array<{
    x: number;
    y: number;
  }>;
}

export const buildEffect = (session: SessionData, defaultFOV: number, totalDuration: number): AnimeTimelineInstance => {
  let { mouseEvents, startTime, endTime } = session;

  if (endTime - startTime > totalDuration) {
    endTime = startTime + totalDuration;
    console.assert(endTime - startTime === totalDuration, `${endTime - startTime} ${totalDuration}`);
  }

  if (!mouseEvents?.length) {
    throw new Error("No mouse events found in the session.");
  }

  const config = {
    zoom: {
      minDuration: 1000,
      minFOVDelta: 20,
      transitionDuration: 500,
    },
    track: {
      minDuration: 1000,
      minPoints: 2,
    },
    effect: {
      joinThreshold: 2000,
      minTimeBetweenEffects: 500,
    }
  };

  const timeline = anime.timeline({ autoplay: false, duration: totalDuration });
  const effects: Effect[] = [];

  let currentZoom: ZoomData | null = null;
  let currentTrack: TrackData | null = null;

  const validEvents = mouseEvents
    .filter(event => {
      const timeInMs = event.time - startTime;
      return typeof event.time === "number" &&
             !isNaN(event.time) &&
             timeInMs >= 0 &&
             timeInMs <= (endTime - startTime);
    })
    .sort((a, b) => a.time - b.time);

  for (const event of validEvents) {
    const timeInMs = event.time - startTime;

    switch (event.type) {
      case "mouseDown":
        if (currentZoom) {
          if (timeInMs - currentZoom.start < config.zoom.minDuration) {
            currentZoom.end = timeInMs;
          } else {
            finalizeEffect('zoom', currentZoom, effects, config);
            currentZoom = createZoomData(timeInMs, event);
          }
        } else {
          currentZoom = createZoomData(timeInMs, event);
        }

        if (currentTrack) {
          if (timeInMs - currentTrack.start < config.track.minDuration) {
            currentTrack.end = timeInMs;
            currentTrack.points.push({ x: event.x, y: event.y });
          } else {
            finalizeEffect('track', currentTrack, effects, config);
            currentTrack = createTrackData(timeInMs, event);
          }
        } else {
          currentTrack = createTrackData(timeInMs, event);
        }
        break;

      case "mouseUp":
        if (currentZoom) {
          currentZoom.end = timeInMs;
          finalizeEffect('zoom', currentZoom, effects, config);
          currentZoom = null;
        }

        if (currentTrack) {
          currentTrack.end = timeInMs;
          currentTrack.points.push({ x: event.x, y: event.y });
          finalizeEffect('track', currentTrack, effects, config);
          currentTrack = null;
        }
        break;

      case "mouseMove":
        if (currentTrack) {
          currentTrack.points.push({ x: event.x, y: event.y });
          currentTrack.end = timeInMs;
        }
        break;
    }
  }

  if (currentZoom) finalizeEffect('zoom', currentZoom, effects, config);
  if (currentTrack) finalizeEffect('track', currentTrack, effects, config);

  joinNearbyEffects(effects, config.effect.joinThreshold);

  let currentTime = 0;

  // Sort effects by start time
  effects.sort((a, b) => a.start - b.start);

  // Add filler zoom effects for gaps
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

    // Check if there's a gap before the current effect
    if (effect.start > currentTime) {
      const gapDuration = effect.start - currentTime;
      console.log(`Adding filler zoom effect for gap: ${gapDuration}ms`);
      addFillerZoomAnimation(timeline, currentTime, gapDuration, defaultFOV);
      currentTime += gapDuration;
    }

    // Add the current effect
    const effectDuration = effect.end - effect.start;

    console.log(`Effect: ${effect.type}`);
    console.log(`Offset: ${currentTime}`);
    console.log(`Total Duration: ${totalDuration}`);
    console.log(`Effect End Time: ${effect.end}`);
    console.log(`Remaining Time: ${totalDuration - currentTime}`);

    if (effect.type === 'zoom') {
      const zoom = effect.data as ZoomData;

      if (currentTime + effectDuration > totalDuration) {
        const adjustedDuration = totalDuration - currentTime;
        if (adjustedDuration > 0) {
          console.log(`Adjusting Zoom Effect Duration: ${adjustedDuration}`);
          addZoomAnimation(timeline, { ...zoom, end: zoom.start + adjustedDuration }, config.zoom, defaultFOV);
          currentTime += adjustedDuration;
        }
      } else {
        addZoomAnimation(timeline, zoom, config.zoom, defaultFOV);
        currentTime += effectDuration;
      }
    } else if (effect.type === 'track') {
      const track = effect.data as TrackData;

      if (currentTime + effectDuration > totalDuration) {
        const adjustedDuration = totalDuration - currentTime;
        if (adjustedDuration > 0) {
          console.log(`Adjusting Track Effect Duration: ${adjustedDuration}`);
          // addTrackAnimation(timeline, { ...track, end: track.start + adjustedDuration }, config.track);
          currentTime += adjustedDuration;
        }
      } else {
        // addTrackAnimation(timeline, track, config.track);
        currentTime += effectDuration;
      }
    }

    console.log(`Current Time After Effect: ${currentTime}`);
    console.log('--------------------------');
  }

  // Check if there's a gap after the last effect
  if (currentTime < totalDuration) {
    const gapDuration = totalDuration - currentTime;
    console.log(`Adding final filler zoom effect for gap: ${gapDuration}ms`);
    addFillerZoomAnimation(timeline, currentTime, gapDuration, defaultFOV);
  }

  return timeline;
};

const addFillerZoomAnimation = (
  timeline: CustomTimeline,
  startTime: number,
  duration: number,
  defaultFOV: number
) => {
  timeline.add({
    targets: { fov: defaultFOV },
    fov: defaultFOV,
    duration: duration,
    easing: 'linear',
    update: (anim) => {
      const app = timeline.app;
      if (app.primary?.camera instanceof PerspectiveCamera && anim.animatables?.[0]?.target) {
        // @ts-ignore
        app.primary.camera.fov = anim.animatables[0].target.fov;
        app.primary.camera.updateProjectionMatrix();
      }
    },
  }, startTime);
};

const createZoomData = (time: number, event: any): ZoomData => ({
  start: time,
  end: time,
  target: { x: event.x, y: event.y }
});

const createTrackData = (time: number, event: any): TrackData => ({
  start: time,
  end: time,
  points: [{ x: event.x, y: event.y }]
});

const finalizeEffect = (
  type: 'zoom' | 'track',
  data: ZoomData | TrackData,
  effects: Effect[],
  config: any
) => {
  const duration = data.end - data.start;
  const minDuration = type === 'zoom' ? config.zoom.minDuration : config.track.minDuration;

  if (duration >= minDuration) {
    if (type === 'track' && (data as TrackData).points.length < config.track.minPoints) {
      return;
    }
    effects.push({ type, start: data.start, end: data.end, data });
  }
};

const joinNearbyEffects = (effects: Effect[], threshold: number) => {
  for (let i = 0; i < effects.length - 1; i++) {
    const current = effects[i];
    const next = effects[i + 1];

    if (next.start - current.end < threshold && current.type === next.type) {
      current.end = next.end;

      if (current.type === 'zoom') {
        (current.data as ZoomData).target = (next.data as ZoomData).target;
      } else if (current.type === 'track') {
        (current.data as TrackData).points.push(...(next.data as TrackData).points);
      }

      effects.splice(i + 1, 1);
      i--;
    }
  }
};

const addZoomAnimation = (
  timeline: CustomTimeline,
  zoom: ZoomData,
  config: any,
  defaultFOV: number
) => {
  const minFOV = defaultFOV - config.minFOVDelta;
  const totalDuration = zoom.end - zoom.start;

  if (totalDuration < config.minDuration) {
    console.warn(`Zoom effect skipped: duration ${totalDuration}ms is less than minDuration ${config.minDuration}ms`);
    return;
  }

  const stayDuration = Math.max(totalDuration - config.transitionDuration, 0);

  timeline.add({
    targets: { fov: defaultFOV },
    fov: minFOV,
    duration: config.transitionDuration / 2,
    easing: 'easeInOutQuad',
    update: (anim) => {
      const app = timeline.app;
      if (app.primary?.camera instanceof PerspectiveCamera && anim.animatables?.[0]?.target) {
        // @ts-ignore
        app.primary.camera.fov = anim.animatables[0].target.fov;
        app.primary.camera.updateProjectionMatrix();
      }
    },
  }, zoom.start);

  const zoomOutStartTime = zoom.start + config.transitionDuration / 2 + stayDuration;
  timeline.add({
    targets: { fov: minFOV },
    fov: defaultFOV,
    duration: config.transitionDuration / 2,
    easing: 'easeInOutQuad',
    update: (anim) => {
      const app = timeline.app;
      if (app.primary?.camera instanceof PerspectiveCamera && anim.animatables?.[0]?.target) {
        // @ts-ignore
        app.primary.camera.fov = anim.animatables[0].target.fov;
        app.primary.camera.updateProjectionMatrix();
      }
    },
  }, zoomOutStartTime);
};

const addTrackAnimation = (
  timeline: CustomTimeline,
  track: TrackData,
  config: any
) => {
  const totalDuration = Math.max(track.end - track.start, config.minDuration);
  const pointDuration = totalDuration / Math.max(track.points.length - 1, 1);

  track.points.forEach((point, index) => {
    if (index < track.points.length - 1) {
      const nextPoint = track.points[index + 1];
      timeline.add({
        targets: { x: point.x, y: point.y },
        x: nextPoint.x,
        y: nextPoint.y,
        duration: pointDuration,
        easing: 'easeInOutQuad',
        update: (anim) => {
          const app = timeline.app;
          if (app.primary?.camera && anim.animatables?.[0]?.target) {
            // Add camera movement logic here
          }
        },
      }, track.start + pointDuration * index);
    }
  });
};
