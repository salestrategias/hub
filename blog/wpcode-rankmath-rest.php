<?php
// SAL — Expõe os campos do Rank Math na REST API (para a automação do blog) — v3
// Instalar como snippet PHP no WPCode (executar em "Run Everywhere").
// v3: adiciona rank_math_facebook_image_id (o Rank Math só renderiza a og:image
// custom quando URL E attachment ID estão salvos).
// Depois disso, POST /wp-json/wp/v2/posts aceita:
//   "meta": {
//     "rank_math_title": "...",              // title tag
//     "rank_math_description": "...",        // meta description
//     "rank_math_focus_keyword": "...",      // keyword-alvo (score do RM)
//     "rank_math_facebook_image": "https://...", // og:image (URL da arte social)
//     "rank_math_facebook_image_id": 123     // og:image (ID do anexo)
//   }
// Escrita exige usuário autenticado com edit_posts (Application Password da automação).

add_action( 'init', function () {
	$campos = [
		'rank_math_title'             => 'string',
		'rank_math_description'       => 'string',
		'rank_math_focus_keyword'     => 'string',
		'rank_math_facebook_image'    => 'string',
		'rank_math_facebook_image_id' => 'integer',
	];
	foreach ( $campos as $campo => $tipo ) {
		register_post_meta( 'post', $campo, [
			'show_in_rest'  => true,
			'single'        => true,
			'type'          => $tipo,
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		] );
	}
} );
