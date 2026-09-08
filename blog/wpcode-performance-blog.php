<?php
// ─────────────────────────────────────────────────────────────────
// SAL — Enxuga o carregamento do blog
//
// O portal (/blog/) e os artigos são desenhados pelos snippets
// "Blog Portal 2026" e "Artigo 2026", que trazem o próprio CSS.
// Mas os dois chamam wp_head(), e por ali entram os arquivos do
// Elementor, do ElementsKit e do addon do tema — nenhum deles é
// usado nessas telas.
//
// Medido em 30/07/2026 num artigo publicado:
//   CSS que bloqueia a primeira pintura .... 1.344 KB em 24 arquivos
//   dos quais só de ElementsKit ............... 886 KB (66%)
//   JS no <head> ................................ 158 KB
//
// Este snippet desenfileira esses arquivos APENAS nas duas telas do
// blog. O resto do site continua exatamente como está, porque as
// páginas feitas no Elementor não entram na condição.
//
// Instalar no WPCode como snippet PHP, "Run Everywhere".
// Rollback = desativar o snippet.
// ─────────────────────────────────────────────────────────────────

add_action( 'wp_enqueue_scripts', function () {

	// as mesmas condições dos snippets que desenham o blog
	$portal = is_home() || is_page( 'blog' );
	$artigo = is_singular( 'post' ) && ! post_password_required();
	if ( ! $portal && ! $artigo ) return;

	// trechos de caminho que identificam o que não é usado no blog
	$descartar = [
		'/plugins/elementor/',
		'/plugins/elementor-pro/',
		'/plugins/elementskit/',
		'/plugins/elementskit-lite/',
		'/plugins/gum-elementor-addon/',
		'/uploads/elementor/',
		'font-awesome',
	];

	$limpa = function ( $fila, $tipo ) use ( $descartar ) {
		foreach ( $fila->queue as $handle ) {
			$item = $fila->registered[ $handle ] ?? null;
			$src  = $item->src ?? '';
			if ( ! $src ) continue;
			foreach ( $descartar as $trecho ) {
				if ( strpos( $src, $trecho ) !== false ) {
					if ( $tipo === 'css' ) {
						wp_dequeue_style( $handle );
					} else {
						wp_dequeue_script( $handle );
					}
					break;
				}
			}
		}
	};

	$limpa( wp_styles(), 'css' );
	$limpa( wp_scripts(), 'js' );

	// o editor de blocos não é usado em nenhuma das duas telas
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'classic-theme-styles' );
	wp_dequeue_style( 'global-styles' );

}, 100 );

// Emoji do WordPress: script e CSS que nenhuma tela do blog usa.
add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
} );
