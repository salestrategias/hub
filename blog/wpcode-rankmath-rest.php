<?php
// SAL — Expõe os campos do Rank Math na REST API (para a automação do blog)
// Instalar como snippet PHP no WPCode (executar em "Run Everywhere" / frontend+admin).
// Depois disso, POST /wp-json/wp/v2/posts aceita:
//   "meta": {
//     "rank_math_title": "...",          // title tag
//     "rank_math_description": "...",    // meta description
//     "rank_math_focus_keyword": "..."   // keyword-alvo (score do RM)
//   }
// Escrita exige usuário autenticado com edit_posts (Application Password da automação).

add_action( 'init', function () {
	$campos = [ 'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword', 'rank_math_facebook_image' ];
	foreach ( $campos as $campo ) {
		register_post_meta( 'post', $campo, [
			'show_in_rest'  => true,
			'single'        => true,
			'type'          => 'string',
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		] );
	}
} );
