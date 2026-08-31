import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Plus, Trash2, ImageOff, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { ListActionBadge } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { ProductIcon } from "./icons/ProductIcon";
import { cn } from "@/lib/utils";

export interface ProductEntry {
  id: string;
  /** base64 data URL — session-only (see CardDataStore), never persisted to
   *  localStorage, so there's no quota concern from storing full images
   *  here the way there would be for the card's own config. */
  dataUrl: string;
  loggedAt: number;
}

export interface ProductCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
}

function newEntryId() {
  return `product_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatLoggedAt(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Everything the bookmark bar's Product chip needs — same "reads the same
 *  store slot the real card does" idiom every other kind's own useXChip
 *  hook already relies on (see useTimestampChip/useChecklistChip). */
export function useProductChip(cardId: string) {
  const [entries, setEntries] = useCardState<ProductEntry[]>(cardId, "entries", () => []);
  const { markDirty, canRecordData } = useCardSession();

  const addFiles = async (files: FileList | File[]) => {
    if (!canRecordData) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    markDirty();
    for (const file of list) {
      const dataUrl = await readAsDataUrl(file);
      setEntries((prev) => [...prev, { id: newEntryId(), dataUrl, loggedAt: Date.now() }]);
    }
  };

  const removeEntry = (entryId: string) => {
    markDirty();
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const clear = () => setEntries([]);

  return { entries, addFiles, removeEntry, clear, count: entries.length, canRecordData };
}

/** Hidden file input + trigger button, shared by every render mode below —
 *  `accept="image/*"` with no `capture` attribute so mobile browsers still
 *  offer the choice between the camera and the photo library, rather than
 *  forcing straight to the camera. */
function AddPhotoInput({
  disabled,
  onFiles,
  inputRef,
}: {
  disabled?: boolean;
  onFiles: (files: FileList) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
    e.target.value = "";
  };
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      disabled={disabled}
      onChange={handleChange}
      className="hidden"
      tabIndex={-1}
      aria-hidden
    />
  );
}

function ProductThumb({
  entry,
  size = "aspect-square",
  onClick,
}: {
  entry: ProductEntry;
  size?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`View photo logged ${formatLoggedAt(entry.loggedAt)}`}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border border-border bg-stone-100 transition-opacity hover:opacity-90",
        size,
      )}
    >
      <img src={entry.dataUrl} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

function AddPhotoTile({
  disabled,
  onClick,
  size = "aspect-square",
}: {
  disabled?: boolean;
  onClick: () => void;
  size?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Add photo"
      className={cn(
        "grid shrink-0 place-items-center gap-1 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 disabled:pointer-events-none disabled:opacity-40",
        size,
      )}
    >
      {/* Fixed stone-300, not inherited currentColor — stays a quiet
       *  illustration of "this box is for a photo" regardless of hover,
       *  rather than joining the Plus/label row's own blue hover highlight
       *  (the row underneath it is the actual actionable cue). */}
      <Camera className="size-6 text-stone-300" strokeWidth={1.75} />
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
        <Plus className="size-3" strokeWidth={2.5} />
        Add Photo
      </span>
    </button>
  );
}

/** Full-size viewer for one logged photo — modeled on PhotoZoom.tsx's own
 *  lightbox styling (rounded white-bordered frame, object-contain, tap to
 *  close) but rendering a plain uploaded image instead of that file's
 *  person/vehicle-coupled Avatar, which this arbitrary work-sample photo
 *  has no relationship to. */
function ProductLightbox({
  entry,
  onOpenChange,
  disabled,
  onDelete,
}: {
  entry: ProductEntry | null;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[min(90vw,480px)] rounded-3xl border-none bg-transparent p-0 shadow-none grid place-items-center [&>button]:bg-white/90 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:right-3 [&>button]:top-3">
        <DialogTitle className="sr-only">Product photo</DialogTitle>
        {entry && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Shrink photo"
              className="grid max-h-[70vh] w-[min(90vw,480px)] place-items-center overflow-hidden rounded-2xl border-4 border-white bg-stone-100 shadow-2xl"
            >
              <img
                src={entry.dataUrl}
                alt=""
                className="max-h-[calc(70vh-8px)] w-full object-contain"
              />
            </button>
            <div className="flex items-center gap-3 rounded-full bg-white/90 px-3 py-1.5 shadow-md">
              <span className="text-[11px] font-medium text-muted-foreground">
                {formatLoggedAt(entry.loggedAt)}
              </span>
              <button
                type="button"
                onClick={() => {
                  onDelete(entry.id);
                  onOpenChange(false);
                }}
                disabled={disabled}
                aria-label="Delete photo"
                className="grid place-items-center rounded-full p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProductCard({
  id,
  title,
  phase = "Intervention",
  description,
  isActive = true,
  onActivate,
  onExpandToStandard,
  reorderEditing,
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
  detailsOpen,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop,
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
}: ProductCardProps) {
  const cardKey = id ?? title;
  const { entries, addFiles, removeEntry, clear, canRecordData } = useProductChip(cardKey);
  const [expanded, setExpanded] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  // Which photo the grid tile's own swipeable gallery is showing — newest
  // first (see displayEntries below), same "current" idea as ChecklistCard/
  // TimestampCard's own tile stepper, just paging through photos instead of
  // items or timestamps.
  const [tileIndex, setTileIndex] = useCardState(cardKey, "tileIndex", 0);
  const { resetSignal } = useCardSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);
  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    clear();
    setViewingId(null);
    setTileIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  // Newest first, matching the standard view's own grid order — swiping the
  // tile browses backward through history from whatever was just added.
  const displayEntries = [...entries].reverse();
  const tileCurrent = Math.min(tileIndex, Math.max(0, displayEntries.length - 1));
  const goToTile = (idx: number) => {
    setTileIndex(Math.max(0, Math.min(idx, displayEntries.length - 1)));
  };

  const hasData = entries.length > 0;
  useReportCardStatus(cardKey, hasData, hasData, {
    title,
    kind: "product",
    value: String(entries.length),
    unit: entries.length === 1 ? "Photo" : "Photos",
  });

  const viewingEntry = entries.find((e) => e.id === viewingId) ?? null;

  const openPicker = () => fileInputRef.current?.click();

  const details = (
    <>
      <DrawerQuickFacts
        icon={<ProductIcon className="size-4" />}
        kind="product"
        dataTypeLabel="Product"
        phase={phase}
        stats={[{ label: "Photos", value: entries.length }]}
      />
      {(teachingProcedure || description) && (
        <div className="mt-4">
          <TeachingProcedureAccordion
            description={description}
            data={teachingProcedure}
            kind="product"
          />
        </div>
      )}
    </>
  );

  const lightbox = (
    <ProductLightbox
      entry={viewingEntry}
      onOpenChange={(open) => !open && setViewingId(null)}
      disabled={!canRecordData}
      onDelete={removeEntry}
    />
  );
  const hiddenInput = (
    <AddPhotoInput inputRef={fileInputRef} disabled={!canRecordData} onFiles={addFiles} />
  );

  if (tileDensity) {
    const large = tileDensity === "large";
    const thumbSize = large ? "size-16" : "size-10";
    return (
      <MiniTileShell
        title={title}
        density={tileDensity}
        isActive={isActive}
        onActivate={onActivate}
        onExpandToStandard={onExpandToStandard}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        actions={
          <div
            className={cn("flex items-center justify-center gap-1.5", large ? "h-[42px]" : "h-7")}
          >
            <span
              className={cn(
                "uppercase tracking-wide text-muted-foreground text-center truncate max-w-full",
                large ? "text-[11px]" : "text-[9px]",
              )}
            >
              <span
                className={cn(
                  "font-bold normal-case tracking-normal tabular-nums text-foreground",
                  large ? "text-sm" : "text-xs",
                )}
              >
                {entries.length}
              </span>{" "}
              {entries.length === 1 ? "Photo" : "Photos"}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              disabled={!canRecordData}
              aria-label="Add photo"
              className={cn(
                "btn-bevel grid shrink-0 place-items-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600 active:bg-blue-600 active:scale-100 disabled:opacity-40",
                large ? "size-7" : "size-5",
              )}
            >
              <span className="grid place-items-center active:scale-95 transition-transform">
                <Plus className={large ? "size-4" : "size-3"} strokeWidth={2.5} />
              </span>
            </button>
          </div>
        }
      >
        {displayEntries.length > 0 ? (
          // Same dots(+large-only nav arrows)-above/paged-content-below
          // shape every other kind's own tile stepper already uses (see
          // ChecklistCard/TimestampCard) — swipes, dot taps, and the arrows
          // all drive the same tileCurrent/goToTile pair, so whichever one
          // last moved it, the other two stay in agreement.
          <div className="w-full flex flex-col items-center gap-1">
            <div className="relative w-full flex items-center justify-center gap-1.5">
              {large && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToTile(tileCurrent - 1);
                    }}
                    disabled={tileCurrent <= 0}
                    aria-label="Previous photo"
                    className="absolute -left-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="size-[18px]" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToTile(tileCurrent + 1);
                    }}
                    disabled={tileCurrent >= displayEntries.length - 1}
                    aria-label="Next photo"
                    className="absolute -right-2 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-blue-500 transition-colors hover:text-blue-600 disabled:text-foreground/30 disabled:pointer-events-none"
                  >
                    <ChevronRight className="size-[18px]" strokeWidth={2.5} />
                  </button>
                </>
              )}
              {displayEntries.map((_, i) => (
                <span
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToTile(i);
                  }}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === tileCurrent
                      ? cn(large ? "size-2" : "size-1.5", "bg-blue-500")
                      : cn(large ? "size-1.5" : "size-1", "bg-stone-300"),
                  )}
                  aria-hidden
                />
              ))}
            </div>
            <SwipeStrip
              count={displayEntries.length}
              current={tileCurrent}
              onCurrentChange={goToTile}
              variant="paged"
              className="w-full"
              itemWrapperClassName="w-full flex items-center justify-center"
            >
              {(i) => {
                const entry = displayEntries[i];
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingId(entry.id);
                    }}
                    aria-label={`View photo ${i + 1} of ${displayEntries.length}`}
                    className={cn(
                      "grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-stone-100",
                      thumbSize,
                    )}
                  >
                    <img src={entry.dataUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              }}
            </SwipeStrip>
          </div>
        ) : (
          <button
            type="button"
            aria-label="No photos yet"
            className={cn(
              "grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-stone-100",
              thumbSize,
            )}
          >
            <ImageOff className={cn("text-stone-300", large ? "size-6" : "size-4")} />
          </button>
        )}
        {hiddenInput}
        {lightbox}
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        dataTypeIcon={<ProductIcon className="size-4" />}
        kind="product"
        dataTypeLabel="Product"
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        details={details}
        progress={null}
        isComplete={hasData}
        actions={
          <ListProductButton
            entries={entries}
            disabled={!canRecordData}
            onFiles={addFiles}
            onDelete={removeEntry}
          />
        }
      />
    );
  }

  return (
    <div className="w-full max-w-md scroll-mt-32">
      <CardShell
        title={title}
        phase={phase}
        dataType="Product"
        dataTypeIcon={<ProductIcon className="size-4" />}
        kind="product"
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        widthMode={widthMode}
        onWidthModeChange={onWidthModeChange}
        progress={null}
        isComplete={hasData}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((v) => !v)}
        helperText={
          <span>
            Logged{" "}
            <span className="font-semibold normal-case tracking-normal tabular-nums text-foreground">
              {entries.length}
            </span>{" "}
            {entries.length === 1 ? "photo" : "photos"}
          </span>
        }
        details={details}
        expandedView={
          <div className="flex flex-col gap-1 px-3 pt-2 pb-3">
            {entries.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                No photos logged yet.
              </p>
            )}
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                <ProductThumb entry={entry} size="size-10" onClick={() => setViewingId(entry.id)} />
                <span className="flex-1 text-sm text-foreground/80">
                  {formatLoggedAt(entry.loggedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  disabled={!canRecordData}
                  aria-label="Delete photo"
                  className="grid place-items-center rounded-full p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={openPicker}
              disabled={!canRecordData}
              className="btn-bevel mt-1 inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full h-7 px-2.5 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-medium transition-colors active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Add Photo
            </button>
          </div>
        }
      >
        <div className="px-3 pt-2 pb-3">
          {entries.length === 0 ? (
            <div className="grid grid-cols-3 gap-2">
              <AddPhotoTile disabled={!canRecordData} onClick={openPicker} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <AddPhotoTile disabled={!canRecordData} onClick={openPicker} />
              {[...entries].reverse().map((entry) => (
                <ProductThumb key={entry.id} entry={entry} onClick={() => setViewingId(entry.id)} />
              ))}
            </div>
          )}
        </div>
      </CardShell>
      {hiddenInput}
      {lightbox}
    </div>
  );
}

/** The List display mode's own compact action row — badge, most-recent
 *  thumbnail (opens the lightbox), and an Add Photo button, entirely
 *  self-contained (its own hidden file input + lightbox state) so it can be
 *  dropped into a List row's `actions` slot as-is. Also reused as-is by the
 *  bookmark bar's own Product chip (see BookmarkChip.tsx), same as
 *  ListChecklistButton/ListRatingButton are for their own kinds. */
export function ListProductButton({
  entries,
  disabled,
  onFiles,
  onDelete,
}: {
  entries: ProductEntry[];
  disabled?: boolean;
  onFiles: (files: FileList) => void;
  onDelete: (id: string) => void;
}) {
  const [viewingId, setViewingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mostRecent = entries.length > 0 ? entries[entries.length - 1] : null;
  const viewingEntry = entries.find((e) => e.id === viewingId) ?? null;

  return (
    <div className="flex items-center gap-1.5">
      <ListActionBadge value={entries.length} weight="bold" />
      {mostRecent && (
        <ProductThumb
          entry={mostRecent}
          size="size-7"
          onClick={() => setViewingId(mostRecent.id)}
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        disabled={disabled}
        aria-label="Add photo"
        className="grid place-items-center size-7 rounded-full text-white transition-colors bg-blue-500 hover:bg-blue-600 active:bg-blue-600 active:scale-100 disabled:opacity-40"
      >
        <span className="grid place-items-center active:scale-95 transition-transform">
          <Plus className="size-3.5" strokeWidth={2.5} />
        </span>
      </button>
      <AddPhotoInput inputRef={fileInputRef} disabled={disabled} onFiles={onFiles} />
      <ProductLightbox
        entry={viewingEntry}
        onOpenChange={(open) => !open && setViewingId(null)}
        disabled={disabled}
        onDelete={onDelete}
      />
    </div>
  );
}
