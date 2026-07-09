/**
 * Scan screen (T022/T029/T030/T035) — composes the full capture → segment →
 * bubbles → detail-modal flow.
 *
 * This file is deliberately a state *orchestrator*, not a state *owner*:
 * every network lifecycle lives in a hook (useCreateScan/useSegmentPerson/
 * useGarmentMatches/useRegionPreference) and every visual lives in an atomic
 * component. What remains here is only the wiring between them — which is
 * exactly what Constitution Principle VIII says a screen should be.
 */

import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BubbleMarker, BUBBLE_DIAMETER } from '@/features/scan/components/BubbleMarker';
import { CameraView, type CapturedPhoto } from '@/features/scan/components/CameraView';
import { GarmentDetailModal } from '@/features/scan/components/GarmentDetailModal';
import { ImportPicker } from '@/features/scan/components/ImportPicker';
import { PersonSelector } from '@/features/scan/components/PersonSelector';
import { RegionPreferenceSettings } from '@/features/scan/components/RegionPreferenceSettings';
import { ScanErrorFallback } from '@/features/scan/components/ScanErrorFallback';
import { SegmentationOverlay } from '@/features/scan/components/SegmentationOverlay';
import { useCreateScan } from '@/features/scan/hooks/useCreateScan';
import { useGarmentMatches } from '@/features/scan/hooks/useGarmentMatches';
import { useRegionPreference } from '@/features/scan/hooks/useRegionPreference';
import { useSegmentPerson } from '@/features/scan/hooks/useSegmentPerson';
import { containFrame, resolveBubblePlacements, type Size } from '@/features/scan/utils/layout';
import type { DetectedGarment, ScanSource } from '@/types/scan';

interface ActivePhoto extends CapturedPhoto {
  source: ScanSource;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();

  // T035: the single region-preference instance whose value feeds every
  // scan request. Matches are region-filtered server-side from the scan
  // session's regionUsed (contracts/scan-api.md), so sending region once at
  // scan creation is the complete wiring — the matches GET takes none.
  const { preference, setRegion, clearOverride } = useRegionPreference();
  const scan = useCreateScan();
  const seg = useSegmentPerson();
  const matches = useGarmentMatches();

  const [photo, setPhoto] = useState<ActivePhoto | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeGarment, setActiveGarment] = useState<DetectedGarment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const session = scan.state.phase === 'ready' ? scan.state.session : null;
  const multiPerson = session !== null && session.people.length > 1;

  // The tap-to-select layer is DERIVED, not stored (FR-016/FR-017): it's up
  // exactly when a multi-person scan exists and no segmentation attempt is
  // pending/settled. Deriving it means "Scan someone else" and failure
  // recoveries only ever call seg.reset() — there's no second flag that can
  // fall out of sync with the segmentation state machine.
  const selecting = multiPerson && seg.state.phase === 'idle';

  /** The garments currently on screen, whichever path produced them. */
  const garments: DetectedGarment[] = multiPerson
    ? seg.state.phase === 'segmented'
      ? seg.state.garments
      : []
    : session?.garments ?? [];

  const selectedPerson = session
    ? multiPerson
      ? session.people.find((person) => person.id === selectedPersonId) ?? null
      : session.people[0] ?? null
    : null;

  const frame =
    photo && containerSize ? containFrame(containerSize, { width: photo.width, height: photo.height }) : null;
  const bubblePlacements = frame ? resolveBubblePlacements(garments, frame, BUBBLE_DIAMETER) : [];

  const resetAll = useCallback(() => {
    setPhoto(null);
    setSelectedPersonId(null);
    setActiveGarment(null);
    setModalVisible(false);
    setImportError(null);
    scan.reset();
    seg.reset();
    matches.clearCache();
  }, [scan, seg, matches]);

  const submitPhoto = useCallback(
    (captured: CapturedPhoto, source: ScanSource) => {
      // Region is guaranteed loaded here — capture controls are disabled
      // until the preference read resolves (see render below).
      if (!preference) return;
      setPhoto({ ...captured, source });
      scan.submit(captured, source, preference.region);
    },
    [preference, scan],
  );

  const handleSelectPerson = useCallback(
    (personId: string) => {
      if (!session) return;
      setSelectedPersonId(personId);
      seg.segment(session.id, personId);
    },
    [session, seg],
  );

  // T029: bubble tap → lazy match fetch + modal open.
  const handleBubblePress = useCallback(
    (garment: DetectedGarment) => {
      if (!session) return;
      setActiveGarment(garment);
      setModalVisible(true);
      matches.fetchMatches(session.id, garment.id);
    },
    [session, matches],
  );

  // T030 / FR-014: closing the modal touches ONLY modal state — photo,
  // session, and bubbles are separate state and remain exactly as they were.
  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    matches.reset();
  }, [matches]);

  // ---- Capture phase -------------------------------------------------------
  if (!photo) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          onCapture={(captured) => submitPhoto(captured, 'camera')}
          disabled={!preference}
          bottomLeftAccessory={
            <ImportPicker
              onPicked={(picked) => submitPhoto(picked, 'import')}
              onError={setImportError}
              disabled={!preference}
            />
          }
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shopping region settings"
          onPress={() => setSettingsVisible(true)}
          style={{ top: insets.top + 8 }}
          className="absolute right-5 h-11 w-11 items-center justify-center rounded-full bg-black/40 active:bg-black/60">
          <Text className="text-base text-white">⚙</Text>
        </Pressable>

        {importError ? (
          <ScanErrorFallback
            title="Can't open your photos"
            message={importError}
            primaryLabel="Open Settings"
            onPrimary={() => Linking.openSettings()}
            secondaryLabel="Dismiss"
            onSecondary={() => setImportError(null)}
          />
        ) : null}

        <RegionSettingsSheet
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          preference={preference}
          onSetRegion={setRegion}
          onClearOverride={clearOverride}
        />
      </View>
    );
  }

  // ---- Review phase (frozen photo + overlays) ------------------------------
  const isBusy = scan.state.phase === 'submitting' || seg.state.phase === 'segmenting';

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
      }}>
      <Image
        source={{ uri: photo.uri }}
        style={{ flex: 1 }}
        contentFit="contain"
        accessibilityLabel="Your captured photo"
      />

      {/* Segmentation glow: active while working, rest once bubbles own the scene. */}
      {frame && selectedPerson && (seg.state.phase === 'segmenting' || garments.length > 0) ? (
        <SegmentationOverlay
          region={selectedPerson.boundingRegion}
          frame={frame}
          mode={garments.length > 0 ? 'rest' : 'active'}
        />
      ) : null}

      {frame
        ? bubblePlacements.map((placement, index) => (
            <BubbleMarker
              key={placement.garment.id}
              garment={placement.garment}
              center={placement.center}
              index={index}
              onPress={handleBubblePress}
            />
          ))
        : null}

      {frame && session && selecting ? (
        <PersonSelector people={session.people} frame={frame} onSelect={handleSelectPerson} />
      ) : null}

      {isBusy ? (
        <View className="absolute bottom-32 left-0 right-0 items-center" pointerEvents="none">
          <View className="flex-row items-center gap-2 rounded-full bg-black/70 px-5 py-2.5">
            <ActivityIndicator size="small" color="#ffffff" />
            <Text className="text-sm font-medium text-white">
              {scan.state.phase === 'submitting' ? 'Identifying garments…' : 'Scanning their outfit…'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* FR-017: revisit other people after finishing one. */}
      {multiPerson && !selecting && garments.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            seg.reset();
            setSelectedPersonId(null);
          }}
          style={{ bottom: insets.bottom + 24 }}
          className="absolute self-center rounded-full bg-white/90 px-5 py-3 active:opacity-80">
          <Text className="text-sm font-semibold text-black">Scan someone else</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start over with a new photo"
        onPress={resetAll}
        style={{ top: insets.top + 8 }}
        className="absolute left-5 h-11 w-11 items-center justify-center rounded-full bg-black/40 active:bg-black/60">
        <Text className="text-base text-white">✕</Text>
      </Pressable>

      {/* ---- Failure surfaces (all render OVER the preserved photo) ---- */}

      {scan.state.phase === 'scanFailed' ? (
        <ScanErrorFallback
          title="Nothing to scan here"
          message={scan.state.reason}
          primaryLabel="New photo"
          onPrimary={resetAll}
        />
      ) : null}

      {scan.state.phase === 'error' ? (
        <ScanErrorFallback
          title="Scan didn't go through"
          message={scan.state.message}
          primaryLabel={scan.state.retryable ? 'Try again' : 'New photo'}
          onPrimary={
            scan.state.retryable ? () => scan.submit(photo, photo.source, preference?.region ?? 'US') : resetAll
          }
          secondaryLabel={scan.state.retryable ? 'New photo' : undefined}
          onSecondary={scan.state.retryable ? resetAll : undefined}
        />
      ) : null}

      {seg.state.phase === 'personFailed' ? (
        <ScanErrorFallback
          title="Couldn't scan that person"
          message={seg.state.reason}
          primaryLabel="Choose someone"
          onPrimary={seg.reset}
          secondaryLabel="New photo"
          onSecondary={resetAll}
        />
      ) : null}

      {seg.state.phase === 'error' ? (
        <ScanErrorFallback
          title="Scan didn't go through"
          message={seg.state.message}
          primaryLabel={seg.state.retryable ? 'Try again' : 'Choose someone'}
          onPrimary={
            seg.state.retryable && session && selectedPersonId
              ? () => seg.segment(session.id, selectedPersonId)
              : seg.reset
          }
          secondaryLabel="New photo"
          onSecondary={resetAll}
        />
      ) : null}

      {/* Person found but zero garments cleared the confidence bar — an
          honest empty state beats an unexplained bubble-less photo. */}
      {session && !multiPerson && !isBusy && garments.length === 0 && scan.state.phase === 'ready' ? (
        <ScanErrorFallback
          title="No garments found"
          message="We recognized the person but couldn't pick out any garments clearly. Try a photo with the outfit more visible."
          primaryLabel="New photo"
          onPrimary={resetAll}
        />
      ) : null}
      {multiPerson && seg.state.phase === 'segmented' && garments.length === 0 ? (
        <ScanErrorFallback
          title="No garments found"
          message="We couldn't pick out any garments on this person. Try someone else, or a clearer photo."
          primaryLabel="Choose someone"
          onPrimary={seg.reset}
          secondaryLabel="New photo"
          onSecondary={resetAll}
        />
      ) : null}

      <GarmentDetailModal
        visible={modalVisible}
        garment={activeGarment}
        // What matches were ACTUALLY filtered by — the session's region —
        // not the live preference, which may have changed since this scan.
        region={session?.regionUsed ?? preference?.region ?? ''}
        state={matches.state}
        onRetry={() => {
          if (session && activeGarment) matches.fetchMatches(session.id, activeGarment.id);
        }}
        onClose={handleModalClose}
      />
    </View>
  );
}

/**
 * Thin presenter for the region settings sheet. Lives here (not in the
 * settings component) because presenting/dismissing a Modal is screen
 * orchestration; RegionPreferenceSettings stays a pure card.
 */
function RegionSettingsSheet({
  visible,
  onClose,
  preference,
  onSetRegion,
  onClearOverride,
}: {
  visible: boolean;
  onClose: () => void;
  preference: ReturnType<typeof useRegionPreference>['preference'];
  onSetRegion: (region: string) => void;
  onClearOverride: () => void;
}) {
  if (!preference) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable accessibilityLabel="Close region settings" className="flex-1" onPress={onClose} />
        <View className="px-4 pb-10">
          <RegionPreferenceSettings
            preference={preference}
            onSetRegion={onSetRegion}
            onClearOverride={onClearOverride}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="mt-3 min-h-12 items-center justify-center rounded-full bg-white py-3 active:opacity-80">
            <Text className="text-base font-semibold text-black">Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
