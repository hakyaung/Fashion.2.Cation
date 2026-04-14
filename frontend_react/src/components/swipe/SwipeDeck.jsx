/**
 * SwipeDeck — copy-friendly swipe card stack (one file).
 *
 * Usage:
 *   import SwipeDeck, { SWIPE_DECK_DEFAULT_LABELS } from './SwipeDeck';
 *   <SwipeDeck
 *     items={items}
 *     keyExtractor={(x) => x.id}
 *     onSwipeLeft={(item) => setItems((a) => a.slice(1))}
 *     onSwipeRight={(item) => { like(item); setItems((a) => a.slice(1)); }}
 *     renderCard={(item) => <YourCard data={item} />}
 *   />
 *
 * Parent owns `items`: after each swipe, remove the first item (or reload).
 * Optional `classes` uses your CSS; omit for built-in inline layout (minimal).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

export const SWIPE_DECK_DEFAULT_LABELS = {
  stampNope: 'NOPE',
  stampLike: 'LIKE',
  iconNope: '\u2715',
  iconLike: '\u2665',
  ariaNope: 'Dislike',
  ariaLike: 'Like',
};

const DEF_THRESHOLD = 96;
const DEF_ROTATE = 0.06;
const DEF_FLY = 520;
const DEF_EXIT_ROT = 18;

const inline = {
  stack: {
    position: 'relative',
    width: '100%',
    maxWidth: 380,
    height: 'min(72vh, 520px)',
    touchAction: 'pan-y',
  },
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    width: '100%',
  },
  back: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    overflow: 'hidden',
    transform: 'scale(0.94) translateY(10px)',
    zIndex: 1,
    filter: 'brightness(0.97)',
    pointerEvents: 'none',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    background: '#fff',
  },
  front: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 2,
    cursor: 'grab',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },
  stampBase: {
    position: 'absolute',
    top: 24,
    zIndex: 4,
    padding: '6px 14px',
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderRadius: 8,
    pointerEvents: 'none',
    border: '3px solid',
  },
  stampNope: { left: 20, color: '#c62828', borderColor: '#c62828', transform: 'rotate(-12deg)' },
  stampLike: { right: 20, color: '#2e7d32', borderColor: '#2e7d32', transform: 'rotate(12deg)' },
  actions: {
    display: 'flex',
    gap: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    width: 58,
    height: 58,
    borderRadius: '50%',
    border: '2px solid rgba(26,22,18,0.08)',
    fontSize: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
  btnNope: { color: '#c62828', borderColor: 'rgba(198,40,40,0.35)' },
  btnLike: { color: '#C4542A', borderColor: 'rgba(196,84,42,0.45)', fontSize: 26 },
};

export default function SwipeDeck({
  items,
  keyExtractor = (_item, index) => index,
  onSwipeLeft,
  onSwipeRight,
  renderCard,
  renderCardBack,
  labels: labelsIn,
  classes = {},
  stackStyle,
  swipeThreshold = DEF_THRESHOLD,
  rotateFactor = DEF_ROTATE,
  flyOutDistance = DEF_FLY,
  exitRotateDeg = DEF_EXIT_ROT,
  showActionButtons = true,
}) {
  const labels = { ...SWIPE_DECK_DEFAULT_LABELS, ...labelsIn };
  const renderBack = renderCardBack || renderCard;

  const [offsetX, setOffsetX] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const dragStartRef = useRef({ x: 0, active: false });
  const offsetRef = useRef(0);
  const topRef = useRef(null);

  const top = items[0] ?? null;
  const second = items[1] ?? null;
  topRef.current = top;

  const firstKey = top != null ? keyExtractor(top, 0) : null;
  useEffect(() => {
    setOffsetX(0);
    offsetRef.current = 0;
    setLeaving(null);
  }, [firstKey]);

  const finishSwipe = useCallback(
    (direction) => {
      const current = topRef.current;
      if (current == null) return;
      if (direction === 'right') onSwipeRight(current);
      else onSwipeLeft(current);
    },
    [onSwipeLeft, onSwipeRight]
  );

  const onPointerDown = (e) => {
    if (leaving || !top) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, active: true };
  };

  const onPointerMove = (e) => {
    if (!dragStartRef.current.active || leaving || !top) return;
    const dx = e.clientX - dragStartRef.current.x;
    offsetRef.current = dx;
    setOffsetX(dx);
  };

  const onPointerUp = (e) => {
    if (!dragStartRef.current.active) return;
    dragStartRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (leaving || !top) return;
    const ox = offsetRef.current;
    if (ox > swipeThreshold) setLeaving('right');
    else if (ox < -swipeThreshold) setLeaving('left');
    else {
      setOffsetX(0);
      offsetRef.current = 0;
    }
  };

  const onTransitionEnd = (e) => {
    if (e.propertyName !== 'transform') return;
    if (leaving === 'right') finishSwipe('right');
    else if (leaving === 'left') finishSwipe('left');
  };

  const triggerButton = (kind) => {
    if (!top || leaving) return;
    setOffsetX(0);
    offsetRef.current = 0;
    setLeaving(kind === 'like' ? 'right' : 'left');
  };

  let tx = offsetX;
  let rot = offsetX * rotateFactor;
  if (leaving === 'right') {
    tx = flyOutDistance;
    rot = exitRotateDeg;
  } else if (leaving === 'left') {
    tx = -flyOutDistance;
    rot = -exitRotateDeg;
  }

  const likeOp = Math.min(1, Math.max(0, (offsetX - 40) / 120));
  const nopeOp = Math.min(1, Math.max(0, (-offsetX - 40) / 120));

  const has = (k) => Boolean(classes[k]);

  if (!top) return null;

  return (
    <div className={classes.root || undefined}>
      <div className={classes.stackWrap || undefined} style={has('stackWrap') ? undefined : inline.wrap}>
        <div
          className={classes.stack || undefined}
          style={has('stack') ? { ...stackStyle } : { ...inline.stack, ...stackStyle }}
        >
          {second != null && (
            <div
              className={classes.cardBack || undefined}
              style={has('cardBack') ? undefined : inline.back}
              aria-hidden="true"
            >
              {renderBack(second)}
            </div>
          )}

          <div
            className={[classes.cardFront, leaving ? classes.cardFrontLeaving : '']
              .filter(Boolean)
              .join(' ') || undefined}
            style={{
              ...(has('cardFront') ? {} : inline.front),
              transform: `translateX(${tx}px) rotate(${rot}deg)`,
              transition: leaving ? 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTransitionEnd={onTransitionEnd}
            role="presentation"
          >
            <div
              className={classes.stampNope || undefined}
              style={
                classes.stampNope
                  ? { opacity: nopeOp }
                  : { ...inline.stampBase, ...inline.stampNope, opacity: nopeOp }
              }
            >
              {labels.stampNope}
            </div>
            <div
              className={classes.stampLike || undefined}
              style={
                classes.stampLike
                  ? { opacity: likeOp }
                  : { ...inline.stampBase, ...inline.stampLike, opacity: likeOp }
              }
            >
              {labels.stampLike}
            </div>
            {renderCard(top)}
          </div>
        </div>

        {showActionButtons && (
          <div className={classes.actions || undefined} style={has('actions') ? undefined : inline.actions}>
            <button
              type="button"
              className={classes.btnNope || undefined}
              style={classes.btnNope ? undefined : { ...inline.btn, ...inline.btnNope }}
              aria-label={labels.ariaNope}
              onClick={() => triggerButton('dislike')}
            >
              {labels.iconNope}
            </button>
            <button
              type="button"
              className={classes.btnLike || undefined}
              style={classes.btnLike ? undefined : { ...inline.btn, ...inline.btnLike }}
              aria-label={labels.ariaLike}
              onClick={() => triggerButton('like')}
            >
              {labels.iconLike}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
