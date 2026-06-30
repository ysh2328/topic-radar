<?php
/**
 * Plugin Name: Topic Radar
 * Description: Public community trend radar shortcode and REST endpoint.
 * Version: 0.1.3
 * Author: tickerread.com
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TOPIC_RADAR_VERSION', '0.1.3');

function topic_radar_sources() {
    return array(
        'stockus' => array(
            'id' => 'stockus',
            'label' => 'stockus',
            'title' => '미주갤',
            'kind' => 'dcinside',
            'galleryId' => 'stockus',
            'pages' => 5,
            'nodes' => 60,
            'refreshMs' => 10 * 60 * 1000,
            'href' => 'https://gall.dcinside.com/mgallery/board/lists/?id=stockus',
        ),
        'thesingularity' => array(
            'id' => 'thesingularity',
            'label' => 'thesingularity',
            'title' => '특이점',
            'kind' => 'dcinside',
            'galleryId' => 'thesingularity',
            'pages' => 3,
            'nodes' => 50,
            'refreshMs' => 15 * 60 * 1000,
            'href' => 'https://gall.dcinside.com/mgallery/board/lists/?id=thesingularity',
        ),
        'chanbiz' => array(
            'id' => 'chanbiz',
            'label' => '4chan /biz/',
            'title' => '4chan /biz/',
            'kind' => '4chan',
            'board' => 'biz',
            'pages' => 5,
            'nodes' => 40,
            'refreshMs' => 10 * 60 * 1000,
            'href' => 'https://boards.4chan.org/biz/catalog',
        ),
    );
}

function topic_radar_default_source() {
    return 'stockus';
}

function topic_radar_initial_source() {
    $path = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
    $path = untrailingslashit((string) $path);
    if (in_array($path, array('/thesingularity', '/singularaty', '/singularity'), true)) {
        return 'thesingularity';
    }
    if (in_array($path, array('/4chan', '/biz', '/chanbiz'), true)) {
        return 'chanbiz';
    }
    return topic_radar_default_source();
}

function topic_radar_initial_page_title($source_id) {
    if ($source_id === 'thesingularity') {
        return '특갤은지금';
    }
    if ($source_id === 'chanbiz') {
        return '지금4chan은';
    }
    return '티커는지금';
}

function topic_radar_shortcode() {
    topic_radar_enqueue_assets();
    $sources = topic_radar_sources();
    $initial_source = topic_radar_initial_source();
    $primary_label = isset($sources[$initial_source]) ? ($initial_source === 'stockus' ? '미주갤' : ($initial_source === 'thesingularity' ? '특갤' : $sources[$initial_source]['label'])) : '미주갤';
    $initial_title = topic_radar_initial_page_title($initial_source);
    ob_start();
    ?>
    <main class="app-shell topic-radar-wp">
      <header class="topbar">
        <h1><?php echo esc_html($initial_title); ?></h1>
      </header>

      <section class="source-board">
        <section class="source-column local-column">
          <div id="primaryLabel" class="source-label"><?php echo esc_html($primary_label); ?></div>
          <section class="cloud-stage" aria-label="현재 화력">
            <div id="wordCloud" class="word-cloud" aria-live="polite">
              <div class="loading-card" aria-label="loading"></div>
            </div>
          </section>
        </section>

        <section id="secondaryColumn" class="source-column secondary-column" hidden>
          <div id="secondaryLabel" class="source-label">4chan /biz/</div>
          <section class="cloud-stage" aria-label="4chan 화력">
            <div id="secondaryCloud" class="word-cloud" aria-live="polite">
              <div class="loading-card" aria-label="loading"></div>
            </div>
          </section>
        </section>
      </section>

      <section id="detailDrawer" class="focus-drawer" hidden>
        <div class="focus-title">포커스</div>
        <section class="panel selected-panel">
          <div class="panel-head focus-head">
            <div>
              <h2 id="selectedTerm">-</h2>
              <span id="selectedMeta">단어를 누르세요</span>
            </div>
            <button id="detailClose" type="button" class="detail-close" aria-label="닫기">×</button>
          </div>
          <div id="relatedTerms" class="related-terms"></div>
          <div id="selectedPosts" class="post-list"></div>
        </section>
      </section>

      <section class="rising-section" aria-label="급상승">
        <div class="section-title">급상승</div>
        <div class="rising-board">
          <section class="panel rising-panel">
            <div id="primaryRisingLabel" class="rising-source-label"><?php echo esc_html($primary_label); ?></div>
            <div id="primaryRisingList" class="rank-list rising-list">
              <div class="empty-note" aria-label="loading"></div>
            </div>
          </section>
          <section id="secondaryRisingColumn" class="panel rising-panel" hidden>
            <div id="secondaryRisingLabel" class="rising-source-label">4chan</div>
            <div id="secondaryRisingList" class="rank-list rising-list">
              <div class="empty-note" aria-label="loading"></div>
            </div>
          </section>
        </div>
      </section>

      <div class="sr-status" aria-live="polite">
        <span id="statusText">loading</span>
        <span id="updatedAt">-</span>
      </div>
    </main>
    <?php
    return ob_get_clean();
}
add_shortcode('topic_radar', 'topic_radar_shortcode');

function topic_radar_enqueue_assets() {
    $url = plugin_dir_url(__FILE__);
    wp_enqueue_style('topic-radar', $url . 'assets/topic-radar.css', array(), TOPIC_RADAR_VERSION);
    wp_enqueue_script('topic-radar', $url . 'assets/topic-radar.js', array(), TOPIC_RADAR_VERSION, true);
    wp_localize_script('topic-radar', 'TopicRadar', array(
        'apiUrl' => esc_url_raw(rest_url('topic-radar/v1/radar')),
    ));
}

add_action('rest_api_init', function () {
    register_rest_route('topic-radar/v1', '/radar', array(
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'topic_radar_rest',
        'args' => array(
            'source' => array('type' => 'string', 'required' => false),
            'refresh' => array('type' => 'string', 'required' => false),
        ),
    ));
});

function topic_radar_rest(WP_REST_Request $request) {
    $sources = topic_radar_sources();
    $source_id = sanitize_key($request->get_param('source') ?: topic_radar_default_source());
    if (!isset($sources[$source_id])) {
        $source_id = topic_radar_default_source();
    }
    $source = $sources[$source_id];
    $cache_key = 'topic_radar_' . $source_id;
    $refresh = $request->get_param('refresh') === '1';

    if (!$refresh) {
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return rest_ensure_response($cached);
        }
    }

    $posts = topic_radar_fetch_posts($source);
    $previous = get_option('topic_radar_snapshot_' . $source_id, null);
    $data = topic_radar_analyze($posts, $source, is_array($previous) ? $previous : null);

    $snapshot = array(
        'at' => current_time('mysql', true),
        'totalPosts' => count($posts),
        'counts' => array(),
    );
    foreach (array_slice($data['terms'], 0, 120) as $term) {
        $snapshot['counts'][$term['term']] = $term['count'];
    }
    update_option('topic_radar_snapshot_' . $source_id, $snapshot, false);
    set_transient($cache_key, $data, (int) floor($source['refreshMs'] / 1000));
    return rest_ensure_response($data);
}

function topic_radar_fetch_posts($source) {
    if (isset($source['kind']) && $source['kind'] === '4chan') {
        return topic_radar_fetch_fourchan_board($source['board'], $source['pages']);
    }
    return topic_radar_fetch_gallery($source['galleryId'], $source['pages']);
}

function topic_radar_fetch_gallery($gallery_id, $pages) {
    $posts = array();
    $seen = array();
    $pages = max(1, min((int) $pages, 10));
    for ($page = 1; $page <= $pages; $page++) {
        $url = 'https://gall.dcinside.com/mgallery/board/lists/?id=' . rawurlencode($gallery_id) . '&page=' . $page;
        $response = wp_remote_get($url, array(
            'timeout' => 20,
            'headers' => array(
                'User-Agent' => 'Mozilla/5.0 (compatible; TopicRadarWP/0.1)',
                'Accept-Language' => 'ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6',
            ),
        ));
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 400) {
            continue;
        }
        foreach (topic_radar_parse_rows(wp_remote_retrieve_body($response), $gallery_id) as $post) {
            $key = $post['id'] ?: $post['url'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $posts[] = $post;
        }
    }
    return $posts;
}

function topic_radar_parse_rows($html, $gallery_id) {
    preg_match_all('/<tr[^>]*class=["\'][^"\']*ub-content[^"\']*["\'][\s\S]*?<\/tr>/i', $html, $matches);
    $posts = array();
    foreach ($matches[0] as $row) {
        $subject = topic_radar_strip(topic_radar_cell($row, 'gall_subject'));
        if (strpos($subject, '공지') !== false || strpos($subject, '설문') !== false) {
            continue;
        }
        $title_cell = topic_radar_cell($row, 'gall_tit');
        preg_match('/<a[^>]*href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)<\/a>/i', $title_cell, $link);
        $title = topic_radar_strip(isset($link[2]) ? $link[2] : $title_cell);
        if (!$title || preg_match('/통합 공지|신문고|용어 모음집|뉴비 가이드|필독/u', $title)) {
            continue;
        }
        $href = isset($link[1]) ? $link[1] : '';
        $date_cell = topic_radar_cell($row, 'gall_date');
        $date = topic_radar_strip($date_cell);
        if (preg_match('/title=["\']([^"\']+)["\']/i', $date_cell, $date_match)) {
            $date = $date_match[1];
        }
        $views = (int) preg_replace('/[^\d]/', '', topic_radar_strip(topic_radar_cell($row, 'gall_count')));
        $reco = (int) preg_replace('/[^\d]/', '', topic_radar_strip(topic_radar_cell($row, 'gall_recommend')));
        $id = '';
        if (preg_match('/data-no=["\']([^"\']+)["\']/i', $row, $id_match)) {
            $id = $id_match[1];
        }
        $posts[] = array(
            'id' => $id,
            'source' => 'dcinside',
            'galleryId' => $gallery_id,
            'subject' => $subject,
            'title' => $title,
            'url' => topic_radar_abs_url($href),
            'date' => $date,
            'views' => $views,
            'reco' => $reco,
            'tokens' => topic_radar_tokenize($title),
        );
    }
    return $posts;
}

function topic_radar_fetch_fourchan_board($board, $pages) {
    $board = preg_replace('/[^a-zA-Z0-9_]/', '', $board ?: 'biz');
    $pages = max(1, min((int) $pages, 15));
    $url = 'https://a.4cdn.org/' . rawurlencode($board) . '/catalog.json';
    $response = wp_remote_get($url, array(
        'timeout' => 20,
        'headers' => array(
            'User-Agent' => 'Mozilla/5.0 (compatible; TopicRadarWP/0.1)',
            'Accept' => 'application/json',
        ),
    ));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 400) {
        return array();
    }
    $catalog = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($catalog)) {
        return array();
    }
    return topic_radar_parse_fourchan_catalog(array_slice($catalog, 0, $pages), $board);
}

function topic_radar_parse_fourchan_catalog($catalog, $board) {
    $posts = array();
    foreach ($catalog as $page) {
        if (!isset($page['threads']) || !is_array($page['threads'])) {
            continue;
        }
        foreach ($page['threads'] as $thread) {
            $no = isset($thread['no']) ? (string) $thread['no'] : '';
            if (!$no || !empty($thread['sticky'])) {
                continue;
            }
            $subject = topic_radar_short_preview(isset($thread['sub']) ? $thread['sub'] : '');
            $body = topic_radar_short_preview(isset($thread['com']) ? $thread['com'] : '');
            $title = $subject ?: $body;
            if (!$title || topic_radar_blocked_post($title . ' ' . $body)) {
                continue;
            }
            $time = isset($thread['time']) ? (int) $thread['time'] : (isset($thread['last_modified']) ? (int) $thread['last_modified'] : 0);
            $date = $time ? gmdate('H:i', $time) : '-';
            $posts[] = array(
                'id' => $board . '-' . $no,
                'source' => '4chan',
                'board' => $board,
                'subject' => $subject ?: 'thread',
                'title' => $title,
                'url' => 'https://boards.4chan.org/' . rawurlencode($board) . '/thread/' . rawurlencode($no),
                'date' => $date,
                'views' => isset($thread['replies']) ? (int) $thread['replies'] : 0,
                'reco' => isset($thread['images']) ? (int) $thread['images'] : 0,
                'replies' => isset($thread['replies']) ? (int) $thread['replies'] : 0,
                'images' => isset($thread['images']) ? (int) $thread['images'] : 0,
                'tokens' => topic_radar_tokenize($title),
            );
        }
    }
    return $posts;
}

function topic_radar_short_preview($value, $max_length = 180) {
    $cleaned = topic_radar_strip($value);
    $cleaned = preg_replace('/https?:\/\/\S+/i', ' ', $cleaned);
    $cleaned = preg_replace('/>>\d+/', ' ', $cleaned);
    $cleaned = trim(preg_replace('/\s+/u', ' ', $cleaned));
    if (topic_radar_text_len($cleaned) <= $max_length) {
        return $cleaned;
    }
    if (function_exists('mb_substr')) {
        return trim(mb_substr($cleaned, 0, $max_length - 1, 'UTF-8')) . '…';
    }
    return trim(substr($cleaned, 0, $max_length - 1)) . '…';
}

function topic_radar_blocked_post($value) {
    return (bool) preg_match('/\b(nigg(?:er|a)|fag(?:got)?|kike|rape|raping|molest|loli|cp|kill yourself|kys|fuck(?:ing)?|creampies?|cum|porn|incest)\b/i', $value);
}

function topic_radar_cell($row, $class_name) {
    if (preg_match('/<td[^>]*class=["\'][^"\']*' . preg_quote($class_name, '/') . '[^"\']*["\'][^>]*>([\s\S]*?)<\/td>/i', $row, $match)) {
        return $match[1];
    }
    return '';
}

function topic_radar_strip($value) {
    return trim(preg_replace('/\s+/u', ' ', html_entity_decode(wp_strip_all_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
}

function topic_radar_abs_url($href) {
    if (strpos($href, 'http') === 0) {
        return $href;
    }
    if (strpos($href, '//') === 0) {
        return 'https:' . $href;
    }
    if (strpos($href, '/') === 0) {
        return 'https://gall.dcinside.com' . $href;
    }
    return 'https://gall.dcinside.com/' . $href;
}

function topic_radar_lower($value) {
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function topic_radar_text_len($value) {
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    preg_match_all('/./us', $value, $chars);
    return count($chars[0]);
}

function topic_radar_stopwords() {
    return array_flip(array_map('topic_radar_lower', array(
        '그리고','그러나','그래서','그냥','진짜','근데','이거','저거','그거','이게','저게','그게',
        '내가','너가','니가','나도','너도','우리','오늘','지금','같은','하는','하면','해서','하고',
        '했다','있음','있는','없는','있다','된다','되는','아니','아님','왜','뭐','좀','더','너무',
        '이번','다음','여기','저기','링크','영상','사진','정보','공지','개념글','싱글벙글','갤러리',
        '마이너','댓글','조회','추천','사람','사람들','생각','이유','절대','사실','언제','많이',
        '원래','필독','계속','추가','예정','뉴비','가이드','특갤','특붕','특붕이','일반','뉴스',
        '질문','리뷰','운영자','매니저','부매니저','등록순','최신순','전체','ㅋㅋ','ㅋㅋㅋ','ㅎㅎ',
        'ㅠㅠ','ㄹㅇ','ㅈㄴ','존나','개','됨','함','할','해','수','나','너','저','걍','말','큰',
        '제목','게시판','기준','소량','룰','분류','태그','급상승','상태','완료','수집','키워드',
        '언급량','대표','떡밥','관련','근황','후기','뻘글','잡담','주식','주가','종목','시장',
        '어떻게','쓰는데','되는데','하는데','같은데','있는데','없는데','되는거','하는거','있는거','이제','가장','새로운','웃긴거',
        '솔직히','요즘','그래','내일','떡','밥','중요','이야기','얘기','정도','소리','갑자기',
        '님들','없냐','있냐','같냐','하냐','되냐','하네','되네','하나','하던데','있','내','살',
        '하','구','거','것','듯','중','전','후',
        'the','and','for','with','from','this','that','what','when','where','why','how','are','was',
        'were','will','would','could','should','have','has','had','you','your','they','them','their',
        'there','here','about','just','like','into','than','then','only','still','going','thread',
        'general','edition','anonymous','anon','last','time','previous','of','to','is','it','in',
        'get','on','all','be','as','at','by','or','if','not','but','do','does','did','can','any',
        'who','which','over','under','more','now','out','up','down','my','me','we','our','us','he',
        'his','she','her','its','no','yes','so','also','one','two','new','old','some','many','much',
        'very','really','im','another','business','finance',
        '새끼','병신','씨발','시발'
    )));
}

function topic_radar_aliases() {
    return array(
        'ai' => 'AI',
        'gpt' => 'GPT',
        'chatgpt' => 'GPT',
        'gemini' => '제미나이',
        'claude' => '클로드',
        'codex' => '코덱스',
        'openai' => 'OpenAI',
        'llm' => 'LLM',
        'api' => 'API',
        'mcp' => 'MCP',
        'gpu' => 'GPU',
        'nvda' => 'NVDA',
        'tsla' => 'TSLA',
        'pltr' => 'PLTR',
        'rklb' => 'RKLB',
        'asts' => 'ASTS',
        'hood' => 'HOOD',
        'sofi' => 'SOFI',
        'soun' => 'SOUN',
        'zeta' => 'ZETA',
        '제미나' => '제미나이',
        '비트' => '비트코인',
        '마소' => 'MSFT',
        '하닉' => 'SK하이닉스',
        '엔비' => 'NVDA',
    );
}

function topic_radar_trim_korean_suffixes($token) {
    $token = preg_replace('/(이라는데|라는데|이라면서|라면서|이라니까|라니까|이라면|이라서|이었는데|였는데|했는데|하는데|되는데|쓰는데|같은데|이었다|였다|입니다|합니다|한다|했다|된다|되는|하는|같은|라고|라는|이고|이며|이면|에서|에게|한테|부터|까지|보다|처럼|마다|으로|하고|이랑|이나|거나|든가|밖에|조차|마저|인데|는데|은데|서|은|는|이|가|을|를|에|도|만|로|와|과|랑)$/u', '', $token);
    $token = preg_replace('/(떡밥|관련|근황|후기|질문|정보|뉴스|글들|글)$/u', '', $token);
    $token = preg_replace('/(으로|에서|에게|한테|부터|까지|보다|처럼|마다|은|는|이|가|을|를|에|도|만|로|와|과|랑)$/u', '', $token);
    return $token;
}

function topic_radar_is_bad_token($token, $stopwords) {
    if (!$token) {
        return true;
    }
    $key = topic_radar_lower($token);
    if (isset($stopwords[$key])) {
        return true;
    }
    if (preg_match('/^\d+$/', $token)) {
        return true;
    }
    if (preg_match('/^[가-힣]+$/u', $token) && topic_radar_text_len($token) < 2) {
        return true;
    }
    if (preg_match('/^[A-Za-z]$/', $token)) {
        return true;
    }
    return false;
}

function topic_radar_tokenize($title) {
    $stopwords = topic_radar_stopwords();
    $aliases = topic_radar_aliases();
    preg_match_all('/[$#@]?[A-Za-z][A-Za-z0-9._+-]{1,9}|[0-9]+(?:\.[0-9]+)+|[가-힣]{2,}/u', $title, $matches);
    $out = array();
    $seen = array();
    foreach ($matches[0] as $raw) {
        $token = trim($raw);
        $token = preg_replace('/^[$#@]+/u', '', $token);
        $lower = topic_radar_lower($token);
        if (isset($aliases[$lower])) {
            $token = $aliases[$lower];
        } elseif (preg_match('/^[A-Za-z][A-Za-z0-9._+-]{1,9}$/', $token)) {
            $token = strlen($token) <= 5 ? strtoupper($token) : strtolower($token);
        } else {
            $token = topic_radar_trim_korean_suffixes($token);
            $lower = topic_radar_lower($token);
            if (isset($aliases[$lower])) {
                $token = $aliases[$lower];
            }
        }
        if (topic_radar_is_bad_token($token, $stopwords)) {
            continue;
        }
        if (isset($seen[$token])) {
            continue;
        }
        $seen[$token] = true;
        $out[] = $token;
        if (count($out) >= 12) {
            break;
        }
    }
    return $out;
}

function topic_radar_analyze($posts, $source, $previous) {
    $nodes = array();
    $links = array();
    foreach ($posts as $post) {
        foreach ($post['tokens'] as $token) {
            if (!isset($nodes[$token])) {
                $nodes[$token] = array('id' => $token, 'term' => $token, 'label' => $token, 'count' => 0, 'views' => 0, 'reco' => 0, 'posts' => array());
            }
            $nodes[$token]['count']++;
            $nodes[$token]['views'] += $post['views'];
            $nodes[$token]['reco'] += $post['reco'];
            if (count($nodes[$token]['posts']) < 6) {
                $nodes[$token]['posts'][] = $post;
            }
        }
    }
    uasort($nodes, function ($a, $b) {
        if ($a['count'] !== $b['count']) {
            return $b['count'] - $a['count'];
        }
        return $b['views'] - $a['views'];
    });
    $terms = array_values(array_slice($nodes, 0, $source['nodes'], true));
    $prev_counts = is_array($previous) && isset($previous['counts']) ? $previous['counts'] : array();
    $keep = array();
    foreach ($terms as $i => &$term) {
        $prev = array_key_exists($term['term'], $prev_counts) ? (int) $prev_counts[$term['term']] : null;
        $delta = $prev === null ? null : $term['count'] - $prev;
        $rate = $prev ? $delta / $prev : null;
        $rising = topic_radar_is_rising($term['count'], $prev, $delta, $rate);
        $term['rank'] = $i + 1;
        $term['previousCount'] = $prev;
        $term['delta'] = $delta;
        $term['growthRate'] = $rate;
        $term['growthScore'] = $delta === null ? null : max(0, $delta) + ($rate && $rate > 0 ? min(4, $rate) : 0);
        $term['rising'] = $rising;
        $term['heat'] = $rising ? 'rising' : (($i < 3 && $term['count'] >= 3) ? 'hot' : 'normal');
        $term['relatedTerms'] = array();
        $keep[$term['term']] = true;
    }
    unset($term);
    $term_index = array();
    foreach ($terms as $i => $term) {
        $term_index[$term['term']] = $i;
    }
    foreach ($posts as $post) {
        $tokens = array_values(array_filter($post['tokens'], function ($t) use ($keep) { return isset($keep[$t]); }));
        for ($i = 0; $i < count($tokens); $i++) {
            for ($j = $i + 1; $j < count($tokens); $j++) {
                $pair = $tokens[$i] < $tokens[$j] ? array($tokens[$i], $tokens[$j]) : array($tokens[$j], $tokens[$i]);
                $key = $pair[0] . '|||' . $pair[1];
                $links[$key] = isset($links[$key]) ? $links[$key] + 1 : 1;
            }
        }
    }
    arsort($links);
    foreach ($links as $key => $count) {
        list($a, $b) = explode('|||', $key);
        if (isset($term_index[$a])) {
            $terms[$term_index[$a]]['relatedTerms'][] = array('term' => $b, 'count' => $count);
        }
        if (isset($term_index[$b])) {
            $terms[$term_index[$b]]['relatedTerms'][] = array('term' => $a, 'count' => $count);
        }
    }
    foreach ($terms as &$term) {
        usort($term['relatedTerms'], function ($a, $b) { return $b['count'] - $a['count']; });
        $term['relatedTerms'] = array_slice($term['relatedTerms'], 0, 8);
    }
    unset($term);
    $rising_terms = array_values(array_filter($terms, function ($term) { return !empty($term['rising']); }));
    usort($rising_terms, function ($a, $b) {
        return ($b['growthScore'] ?? 0) <=> ($a['growthScore'] ?? 0);
    });
    return array(
        'generatedAt' => current_time('mysql', true),
        'source' => array_intersect_key($source, array_flip(array('id', 'label', 'title', 'href', 'pages', 'refreshMs'))),
        'sources' => array_values(array_map(function ($s) { return array_intersect_key($s, array_flip(array('id', 'label', 'title', 'href'))); }, topic_radar_sources())),
        'totalPosts' => count($posts),
        'terms' => $terms,
        'topTerms' => array_slice($terms, 0, 24),
        'risingTerms' => array_slice($rising_terms, 0, 12),
        'nodes' => $terms,
        'links' => array(),
        'posts' => array_slice($posts, 0, 80),
        'tags' => array(),
        'stats' => array(
            'totalPosts' => count($posts),
            'termCount' => count($terms),
            'linkCount' => count($links),
            'previousAt' => is_array($previous) && isset($previous['at']) ? $previous['at'] : null,
            'comparisonReady' => is_array($previous),
            'tokenizer' => 'php-fallback',
            'cached' => false,
            'refreshing' => false,
        ),
    );
}

function topic_radar_is_rising($count, $previous, $delta, $rate) {
    if ($previous === null || $delta === null || $delta <= 0) {
        return false;
    }
    if ($previous === 0) {
        return $count >= 4;
    }
    if ($delta >= 3) {
        return true;
    }
    return $delta >= 2 && $rate !== null && $rate >= 1 && $count >= 6;
}
