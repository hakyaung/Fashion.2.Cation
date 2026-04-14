import React, { useState, useEffect, useCallback } from 'react';
import { fetchPosts, ensureLikeApi, resolveMediaUrl } from '../../api/api';
import { useAuth } from '../../context/Authcontext';
import SwipeDeck from '../swipe/SwipeDeck';

const T = {
  loading: '\uc2a4\uc640\uc774\ud504\ud560 \uc2a4\ud0c0\uc77c\uc744 \ubd88\ub7ec\uc624\ub294 \uc911...',
  loadErr: '\uc2a4\ud0c0\uc77c\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.',
  retry: '\ub2e4\uc2dc \uc2dc\ub3c4',
  emptyTitle: '\ubaa8\ub4e0 \uce74\ub4dc\ub97c \ud655\uc778\ud588\uc5b4\uc694',
  emptyHint:
    '\uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc624\uc2dc\uac70\ub098, \uc544\ub798\uc5d0\uc11c \uc0c8 \uce74\ub4dc\ub97c \ubd88\ub7ec\uc624\uc138\uc694.',
  reload: '\uc0c8 \uc2a4\ud0c0\uc77c \ubd88\ub7ec\uc624\uae30',
  pageTitle: '\ud328\uc158 \ud3c9\uac00',
  pageSub1:
    '\uc67c\ucabd\uc73c\ub85c \uc2a4\uc640\uc774\ud504\ud558\uba74 \uc2eb\uc5b4\uc694, \uc624\ub978\ucabd\uc73c\ub85c \uc2a4\uc640\uc774\ud504\ud558\uba74 \uc88b\uc544\uc694\uc608\uc694.',
  pageSubLogin: ' (\uc88b\uc544\uc694\ub294 \ub85c\uadf8\uc778 \ud6c4 \ubc18\uc601\ub429\ub2c8\ub2e4.)',
  stampNope: '\uc2eb\uc5b4\uc694',
  stampLike: '\uc88b\uc544\uc694',
  altStyle: '\ud328\uc158 \uc2a4\ud0c0\uc77c',
  ariaNope: '\uc2eb\uc5b4\uc694',
  ariaLike: '\uc88b\uc544\uc694',
  iconNope: '\u2715',
  iconLike: '\u2665',
};

const DECK_CLASSES = {
  stackWrap: 'fashion-eval-stack-wrap',
  stack: 'fashion-eval-stack',
  cardBack: 'fashion-eval-card fashion-eval-card--back',
  cardFront: 'fashion-eval-card fashion-eval-card--front',
  cardFrontLeaving: 'fashion-eval-card--leaving',
  actions: 'fashion-eval-actions',
  btnNope: 'fashion-eval-btn fashion-eval-btn--nope',
  btnLike: 'fashion-eval-btn fashion-eval-btn--like',
  stampNope: 'fashion-eval-stamp fashion-eval-stamp--nope',
  stampLike: 'fashion-eval-stamp fashion-eval-stamp--like',
};

async function loadPostsWithImages(minCount = 18) {
  const collected = [];
  const seen = new Set();
  let skip = 0;
  const maxSkip = 220;

  while (collected.length < minCount && skip < maxSkip) {
    const batch = await fetchPosts({
      skip,
      limit: 12,
      sort: 'popular',
      q: '',
    });
    if (!batch.length) break;
    for (const p of batch) {
      if (!p.image_url || !String(p.image_url).trim()) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      collected.push(p);
    }
    skip += 12;
  }

  for (let i = collected.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [collected[i], collected[j]] = [collected[j], collected[i]];
  }
  return collected;
}

function renderPostCard(post) {
  return (
    <>
      <img src={resolveMediaUrl(post.image_url)} alt={post.content || T.altStyle} />
      <div className="fashion-eval-card-body">
        <p className="fashion-eval-caption">{post.content}</p>
        <div className="fashion-eval-card-meta">
          <span>{post.author}</span>
          <span className="fashion-eval-loc">{post.location}</span>
        </div>
      </div>
    </>
  );
}

export default function FashionEvalView() {
  const { isLoggedIn, openAuthModal } = useAuth();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const posts = await loadPostsWithImages(20);
      setDeck(posts);
    } catch (e) {
      setLoadError(T.loadErr);
      setDeck([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const popDeck = useCallback(() => {
    setDeck((d) => d.slice(1));
  }, []);

  const handleLike = useCallback(
    async (post) => {
      if (!post) return;
      if (!isLoggedIn) {
        openAuthModal('login');
        popDeck();
        return;
      }
      try {
        await ensureLikeApi(post.id);
      } catch {
        /* ignore */
      }
      popDeck();
    },
    [isLoggedIn, openAuthModal, popDeck]
  );

  const onSwipeLeft = useCallback(() => {
    popDeck();
  }, [popDeck]);

  const onSwipeRight = useCallback(
    (post) => {
      void handleLike(post);
    },
    [handleLike]
  );

  const swipeLabels = {
    stampNope: T.stampNope,
    stampLike: T.stampLike,
    iconNope: T.iconNope,
    iconLike: T.iconLike,
    ariaNope: T.ariaNope,
    ariaLike: T.ariaLike,
  };

  if (loading) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-loading">{T.loading}</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-empty">
          <p>{loadError}</p>
          <button type="button" className="fashion-eval-reload" onClick={reload}>
            {T.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!deck.length) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-empty">
          <h2 className="fashion-eval-title">{T.emptyTitle}</h2>
          <p>{T.emptyHint}</p>
          <button type="button" className="fashion-eval-reload" onClick={reload}>
            {T.reload}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fashion-eval">
      <header className="fashion-eval-header">
        <h1 className="fashion-eval-title">{T.pageTitle}</h1>
        <p className="fashion-eval-sub">
          {T.pageSub1}
          {!isLoggedIn ? T.pageSubLogin : ''}
        </p>
      </header>

      <SwipeDeck
        items={deck}
        keyExtractor={(p) => p.id}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
        renderCard={renderPostCard}
        labels={swipeLabels}
        classes={DECK_CLASSES}
      />
    </div>
  );
}
