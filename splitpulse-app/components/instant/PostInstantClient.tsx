"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  MapPin,
  Navigation,
  X,
  Zap,
} from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { INSTANT_TYPE_META } from "@/lib/instant/typeMeta";
import type { InstantType, Location } from "@/types";

const POSTABLE_TYPES: InstantType[] = [
  "photo",
  "text",
  "crowd",
  "question",
  "help",
  "event",
  "recommendation",
  "warning",
];

const POST_RADIUS_METERS = 100;
const STEP_LABELS = ["Photo", "Details", "Post"] as const;

interface Props {
  locations: Location[];
  initialLocationSlug: string | null;
  pulseName: string | null;
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function PostInstantClient({
  locations,
  initialLocationSlug,
  pulseName,
}: Props) {
  const router = useRouter();
  const geo = useGeolocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [type, setType] = useState<InstantType>("photo");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image],
  );

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const nearbyLocations = useMemo(() => {
    if (!geo.coords) return [];
    return locations
      .map((location) => ({
        location,
        distance: distanceMeters(geo.coords!, location),
      }))
      .filter((item) => item.distance <= POST_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);
  }, [geo.coords, locations]);

  const requestedNearbyLocation = nearbyLocations.find(
    ({ location }) => location.slug === initialLocationSlug,
  );
  const selectedLocation =
    nearbyLocations.find(({ location }) => location.id === selectedLocationId)
      ?.location ??
    requestedNearbyLocation?.location ??
    nearbyLocations[0]?.location ??
    null;

  const canSubmit =
    Boolean(geo.coords) && Boolean(selectedLocation) && (image !== null || content.trim().length > 0);

  const goNext = () => {
    setError(null);
    if (step === 0) {
      if (!image) {
        setType((current) => (current === "photo" ? "text" : current));
      }
      setStep(1);
    } else if (step === 1) {
      if (!image && content.trim().length === 0) {
        setError("Add a photo or write a caption first.");
        return;
      }
      setStep(2);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 0) {
      router.back();
    } else {
      setStep((current) => (current - 1) as 0 | 1 | 2);
    }
  };

  const submit = async () => {
    setError(null);
    if (!geo.coords) {
      setError(geo.error ?? "Waiting for GPS — try again in a sec.");
      return;
    }
    if (!selectedLocation) {
      setError(
        `You can post only within ${POST_RADIUS_METERS}m of a real object.`,
      );
      return;
    }
    if (!image && !content.trim()) {
      setError("Add a photo or a caption.");
      return;
    }

    setSubmitting(true);
    try {
      await fetch("/api/auth/guest", { method: "POST" });

      const fd = new FormData();
      fd.append("type", type);
      if (content.trim()) fd.append("content", content.trim());
      fd.append("latitude", String(geo.coords.latitude));
      fd.append("longitude", String(geo.coords.longitude));
      fd.append("location_id", selectedLocation.id);
      if (image) fd.append("image", image);

      const r = await fetch("/api/instants", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed to post");

      router.push(`/map?focus=${selectedLocation.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition active:scale-95"
          aria-label={step === 0 ? "Cancel" : "Back"}
        >
          {step === 0 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>

        <Stepper currentStep={step} />

        <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-bold text-black">
          {pulseName ? pulseName[0]?.toUpperCase() : "@"}
        </div>
      </header>

      <main className="mt-5 flex-1">
        {step === 0 && (
          <PhotoStep
            image={image}
            imagePreviewUrl={imagePreviewUrl}
            onPickFile={(file) => {
              setImage(file);
              if (file) setType("photo");
            }}
            fileInputRef={fileInputRef}
          />
        )}

        {step === 1 && (
          <DetailsStep
            type={type}
            content={content}
            imagePreviewUrl={imagePreviewUrl}
            onTypeChange={setType}
            onContentChange={setContent}
          />
        )}

        {step === 2 && (
          <PostStep
            geo={geo}
            nearbyLocations={nearbyLocations}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocationId}
            content={content}
            type={type}
            imagePreviewUrl={imagePreviewUrl}
          />
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </main>

      <footer className="mt-5">
        {step < 2 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-black transition active:scale-[0.98]"
          >
            {step === 0 && !image ? "Skip · No photo" : "Continue"}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] py-3.5 text-sm font-bold text-[var(--text-inverse)] transition active:scale-[0.98] disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {submitting ? "Posting…" : "Post Instant"}
          </button>
        )}
      </footer>
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, index) => {
        const active = index === currentStep;
        const done = index < currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                active
                  ? "bg-white text-black"
                  : done
                    ? "bg-[var(--accent-primary)] text-[var(--text-inverse)]"
                    : "border border-white/15 bg-white/[0.04] text-white/45"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : index + 1}
            </div>
            {index < STEP_LABELS.length - 1 && (
              <div
                className={`h-px w-4 ${
                  done ? "bg-[var(--accent-primary)]" : "bg-white/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhotoStep({
  image,
  imagePreviewUrl,
  onPickFile,
  fileInputRef,
}: {
  image: File | null;
  imagePreviewUrl: string | null;
  onPickFile: (file: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight text-white">
        Capture the moment
      </h1>
      <p className="mt-1 text-sm text-white/55">
        Snap a photo to anchor your Instant. You can skip and post text-only.
      </p>

      <label className="mt-5 block aspect-[9/12] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {imagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreviewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black">
              <Camera className="h-9 w-9" />
            </span>
            <span className="text-base font-bold text-white">
              Tap to open camera
            </span>
            <span className="max-w-56 text-xs leading-snug text-white/45">
              Native camera opens on phones. Photos must be shot at the
              location.
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {image && (
        <button
          type="button"
          onClick={() => onPickFile(null)}
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-semibold text-white/70 transition active:scale-[0.98]"
        >
          Retake or remove photo
        </button>
      )}
    </div>
  );
}

function DetailsStep({
  type,
  content,
  imagePreviewUrl,
  onTypeChange,
  onContentChange,
}: {
  type: InstantType;
  content: string;
  imagePreviewUrl: string | null;
  onTypeChange: (type: InstantType) => void;
  onContentChange: (content: string) => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight text-white">
        What is happening?
      </h1>
      <p className="mt-1 text-sm text-white/55">
        Pick a category, add a quick caption.
      </p>

      {imagePreviewUrl && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreviewUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
          <p className="text-xs text-white/55">
            Photo attached · will be shown with this Instant.
          </p>
        </div>
      )}

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          Type
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {POSTABLE_TYPES.map((t) => {
            const meta = INSTANT_TYPE_META[t];
            const active = type === t;
            return (
              <button
                type="button"
                key={t}
                onClick={() => onTypeChange(t)}
                className={`rounded-2xl px-2 py-3 text-xs font-semibold transition active:scale-[0.97] ${
                  active
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/65"
                }`}
              >
                <div className="text-xl leading-none">{meta.icon}</div>
                <div className="mt-1.5 text-[11px]">{meta.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          Caption
        </p>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value.slice(0, 280))}
          placeholder="Add a quick line. Optional if you have a photo."
          rows={4}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-white/30 focus:bg-white/[0.07]"
        />
        <p className="mt-1 text-right text-[11px] text-white/40">
          {content.length}/280
        </p>
      </div>
    </div>
  );
}

function PostStep({
  geo,
  nearbyLocations,
  selectedLocation,
  onSelectLocation,
  content,
  type,
  imagePreviewUrl,
}: {
  geo: ReturnType<typeof useGeolocation>;
  nearbyLocations: { location: Location; distance: number }[];
  selectedLocation: Location | null;
  onSelectLocation: (id: string) => void;
  content: string;
  type: InstantType;
  imagePreviewUrl: string | null;
}) {
  const meta = INSTANT_TYPE_META[type];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold leading-tight text-white">
          Ready to post?
        </h1>
        <p className="mt-1 text-sm text-white/55">
          One last check. You can only post within {POST_RADIUS_METERS}m of an
          object.
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        {imagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreviewUrl}
            alt=""
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-gradient-to-br from-white/[0.05] to-black/30" />
        )}
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <span aria-hidden>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
          <p className="text-base font-semibold leading-snug text-white">
            {content.trim() || meta.label}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-white/55">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Posting zone
          </span>
          <span>{nearbyLocations.length} nearby</span>
        </div>

        {!geo.coords && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-black/30 p-3">
            <span className="text-xs text-white/55">
              {geo.loading ? "Locating…" : geo.error ?? "GPS unavailable"}
            </span>
            <button
              type="button"
              onClick={() => geo.request()}
              disabled={geo.loading}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black disabled:opacity-60"
            >
              <Navigation className="inline h-3 w-3" />{" "}
              {geo.loading ? "…" : "Enable"}
            </button>
          </div>
        )}

        {geo.coords && nearbyLocations.length === 0 && (
          <p className="mt-3 text-sm text-red-300">
            You are not within {POST_RADIUS_METERS}m of any object.
          </p>
        )}

        {nearbyLocations.length > 0 && (
          <div className="mt-3 space-y-2">
            {nearbyLocations.map(({ location, distance }) => {
              const active = selectedLocation?.id === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => onSelectLocation(location.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition active:scale-[0.99] ${
                    active
                      ? "bg-white text-black"
                      : "bg-white/[0.04] text-white/80"
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">
                    {location.name}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      active ? "text-black/60" : "text-white/50"
                    }`}
                  >
                    {Math.round(distance)}m
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
