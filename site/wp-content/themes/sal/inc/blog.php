<?php
/**
 * Blog da SAL — o portal de conteúdo dentro do tema.
 *
 * O que antes vivia em snippets do WPCode interceptando template_redirect
 * agora mora nos templates que o WordPress espera: home.php (portal),
 * category.php (editoria) e single.php (artigo). Este arquivo reúne o que
 * esses templates precisam: assets, consultas, helpers de exibição e a
 * limpeza de plugins que não participam do blog.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * As telas em que o blog manda: portal, editoria, artigo, busca e demais
 * arquivos de post. Tudo que é específico do blog testa esta condição.
 */
function sal_blog_tela(): bool {
	// Arquivos de tag e de data ficam de fora de propósito: ainda usam o
	// template antigo, e receber só o CSS novo os deixaria pela metade.
	return is_home() || is_category() || is_search()
		|| ( is_singular( 'post' ) && ! post_password_required() );
}

/* -------------------------------------------------------------------------
 * Assets: o CSS do blog só nas telas do blog, e os pesos de Elementor,
 * ElementsKit e afins fora delas. Nenhuma tela do blog usa page builder;
 * medido em produção, só o CSS deles somava 1,3 MB bloqueando a pintura.
 * ---------------------------------------------------------------------- */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! sal_blog_tela() ) {
		return;
	}

	$css = get_template_directory() . '/assets/css/blog.css';
	if ( file_exists( $css ) ) {
		wp_enqueue_style( 'sal-blog', get_template_directory_uri() . '/assets/css/blog.css', array( 'sal-fontes' ), (string) filemtime( $css ) );
	}

	$descartar = array(
		'/plugins/elementor/',
		'/plugins/elementor-pro/',
		'/plugins/elementskit/',
		'/plugins/elementskit-lite/',
		'/plugins/gum-elementor-addon/',
		'/plugins/metform/',
		'/uploads/elementor/',
		'font-awesome',
	);

	$limpar = function ( $fila, $tipo ) use ( $descartar ) {
		foreach ( $fila->queue as $handle ) {
			$src = $fila->registered[ $handle ]->src ?? '';
			if ( ! $src ) {
				continue;
			}
			foreach ( $descartar as $trecho ) {
				if ( false !== strpos( $src, $trecho ) ) {
					'css' === $tipo ? wp_dequeue_style( $handle ) : wp_dequeue_script( $handle );
					break;
				}
			}
		}
	};

	$limpar( wp_styles(), 'css' );
	$limpar( wp_scripts(), 'js' );

	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'classic-theme-styles' );
	wp_dequeue_style( 'global-styles' );
}, 100 );

// A Newsreader é a fonte dos títulos do blog: entra no preload junto das outras.
add_action( 'wp_head', function () {
	if ( ! sal_blog_tela() ) {
		return;
	}
	echo '<link rel="preload" href="' . esc_url( get_template_directory_uri() . '/assets/fonts/newsreader-var.woff2' ) . '" as="font" type="font/woff2" crossorigin>' . "\n";
}, 2 );

/* -------------------------------------------------------------------------
 * Consultas: editoria pagina de 12 em 12. O Google Discover pede imagem
 * grande, então o tamanho de capa sobe para 1200 de largura.
 * ---------------------------------------------------------------------- */
add_action( 'pre_get_posts', function ( $q ) {
	if ( ! is_admin() && $q->is_main_query() && $q->is_category() ) {
		$q->set( 'posts_per_page', 12 );
	}
} );

add_action( 'after_setup_theme', function () {
	add_image_size( 'sal-capa', 1200, 675, true );
}, 11 );

/* -------------------------------------------------------------------------
 * Helpers de exibição usados pelos templates do blog.
 * ---------------------------------------------------------------------- */

/**
 * As editorias da navegação: categorias com artigo publicado, da maior para
 * a menor. Os nomes vêm do próprio WordPress — renomear a categoria no
 * painel muda o menu junto.
 *
 * @return WP_Term[]
 */
function sal_blog_editorias(): array {
	$termos = get_categories( array(
		'orderby'    => 'count',
		'order'      => 'DESC',
		'hide_empty' => true,
		'number'     => 6,
	) );
	return array_values( array_filter( $termos, function ( $t ) {
		return 'uncategorized' !== $t->slug;
	} ) );
}

/**
 * A categoria principal do post, para o rótulo do card e o breadcrumb.
 */
function sal_blog_categoria( WP_Post $post ): ?WP_Term {
	$cats = get_the_category( $post->ID );
	return $cats ? $cats[0] : null;
}

/**
 * Data no formato da casa: "30 de julho de 2026".
 */
function sal_blog_data( WP_Post $post ): string {
	return date_i18n( 'j \d\e F \d\e Y', strtotime( $post->post_date ) );
}

/**
 * Tempo de leitura estimado, em minutos, a 200 palavras por minuto.
 */
function sal_blog_leitura( WP_Post $post ): int {
	$palavras = str_word_count( wp_strip_all_tags( $post->post_content ) );
	return max( 1, (int) round( $palavras / 200 ) );
}

/**
 * Resumo sem shortcode e sem reticências de entidade.
 */
function sal_blog_resumo( WP_Post $post, int $palavras = 24 ): string {
	$texto = $post->post_excerpt ?: wp_strip_all_tags( strip_shortcodes( $post->post_content ) );
	return wp_trim_words( $texto, $palavras, '…' );
}

/**
 * Um card da grade. Usado no portal, na editoria, na busca e nos relacionados.
 */
function sal_blog_card( WP_Post $post ): void {
	$cat = sal_blog_categoria( $post );
	?>
	<a class="sb-card" href="<?php echo esc_url( get_permalink( $post ) ); ?>">
		<figure><?php echo get_the_post_thumbnail( $post, 'sal-card', array( 'loading' => 'lazy', 'decoding' => 'async' ) ); ?></figure>
		<div>
			<?php if ( $cat ) : ?><span class="sb-cat"><?php echo esc_html( $cat->name ); ?></span><?php endif; ?>
			<h3><?php echo esc_html( get_the_title( $post ) ); ?></h3>
			<time datetime="<?php echo esc_attr( get_the_date( 'c', $post ) ); ?>"><?php echo esc_html( sal_blog_data( $post ) ); ?></time>
		</div>
	</a>
	<?php
}

/**
 * Os guias de fundação, na ordem editorial definida pelo Marcelo.
 *
 * @return WP_Post[]
 */
function sal_blog_guias(): array {
	$slugs = array(
		'roas-alto-mas-sem-lucro',
		'loja-virtual-nao-vende-o-que-fazer',
		'como-estruturar-marketing-de-uma-loja',
		'cac-e-ltv-como-calcular-metricas-negocio',
	);
	$out = array();
	foreach ( $slugs as $slug ) {
		$p = get_page_by_path( $slug, OBJECT, 'post' );
		if ( $p && 'publish' === $p->post_status ) {
			$out[] = $p;
		}
	}
	return $out;
}

/**
 * Endereço da agenda de diagnóstico, o destino de todos os CTAs do blog.
 */
function sal_blog_cta_url(): string {
	return home_url( '/agenda/' );
}

/**
 * Newsletter do Marcelo no Substack, com UTM da tela atual.
 */
function sal_blog_news_url( string $origem ): string {
	return 'https://marcelofreitas.substack.com/subscribe?utm_source=blog-sal&utm_medium=' . rawurlencode( $origem );
}
