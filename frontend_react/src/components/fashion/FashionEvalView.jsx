import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // 💡 다국어 훅 추가
import { fetchPosts, ensureLikeApi, resolveMediaUrl } from '../../api/api';
import { useAuth } from '../../context/Authcontext';
import SwipeDeck from '../swipe/SwipeDeck';
import TranslatableText from '../common/TranslatableText'; // 💡 텍스트 번역 컴포넌트 추가

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

// 💡 기존 로직 완벽 유지: 썸네일 이미지가 있는 게시물만 모아서 무작위로 섞음
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

export default function FashionEvalView() {
  const { t } = useTranslation(); // 💡 다국어 함수 가져오기
  const { isLoggedIn, openAuthModal } = useAuth();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // 💡 카드 렌더링 함수를 useCallback으로 감싸고 다국어 및 번역 컴포넌트 적용
  const renderPostCard = useCallback(
    (post) => (
      <>
        <img src={resolveMediaUrl(post.image_url)} alt={post.content || t('fashionEval.altStyle')} />
        <div className="fashion-eval-card-body">
          <p className="fashion-eval-caption">
            <TranslatableText text={post.content} compact />
          </p>
          <div className="fashion-eval-card-meta">
            <span>{post.author}</span>
            <span className="fashion-eval-loc">{post.location}</span>
          </div>
        </div>
      </>
    ),
    [t]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const posts = await loadPostsWithImages(20);
      setDeck(posts);
    } catch (e) {
      setLoadError(t('fashionEval.loadErr')); // 💡 다국어 적용
      setDeck([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  // 💡 다국어 라벨 매핑 (useMemo로 최적화)
  const swipeLabels = useMemo(
    () => ({
      stampNope: t('fashionEval.stampNope'),
      stampLike: t('fashionEval.stampLike'),
      iconNope: '\u2715',
      iconLike: '\u2665',
      ariaNope: t('fashionEval.ariaNope'),
      ariaLike: t('fashionEval.ariaLike'),
    }),
    [t]
  );

  if (loading) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-loading">{t('fashionEval.loading')}</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-empty">
          <p>{loadError}</p>
          <button type="button" className="fashion-eval-reload" onClick={reload}>
            {t('fashionEval.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!deck.length) {
    return (
      <div className="fashion-eval">
        <div className="fashion-eval-empty">
          <h2 className="fashion-eval-title">{t('fashionEval.emptyTitle')}</h2>
          <p>{t('fashionEval.emptyHint')}</p>
          <button type="button" className="fashion-eval-reload" onClick={reload}>
            {t('fashionEval.reload')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fashion-eval">
      <header className="fashion-eval-header">
        <h1 className="fashion-eval-title">{t('fashionEval.pageTitle')}</h1>
        <p className="fashion-eval-sub">
          {t('fashionEval.pageSub1')}
          {!isLoggedIn ? t('fashionEval.pageSubLogin') : ''}
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