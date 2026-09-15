<?php
/**
 * Endurecimento no nível do tema.
 *
 * Só medidas seguras de aplicar por padrão — nada que quebre plugin ou
 * fluxo de publicação. Recomendações de wp-config (DISALLOW_FILE_EDIT etc.)
 * estão no site/README.md.
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// XML-RPC: vetor clássico de brute force; o site não usa app remoto legado.
// A publicação automática do blog usa a REST API, que continua ativa.
add_filter( 'xmlrpc_enabled', '__return_false' );

// Sem a versão do WP no <head> nem nos feeds (dificulta fingerprinting).
remove_action( 'wp_head', 'wp_generator' );
add_filter( 'the_generator', '__return_empty_string' );

// Sem ?ver=6.x nos assets do core (mesmo motivo). Os assets do tema usam
// filemtime, então o cache busting continua funcionando.
add_filter( 'style_loader_src', 'sal_remover_versao_core', 10 );
add_filter( 'script_loader_src', 'sal_remover_versao_core', 10 );
function sal_remover_versao_core( $src ) {
	if ( $src && str_contains( $src, 'ver=' . get_bloginfo( 'version' ) ) ) {
		$src = remove_query_arg( 'ver', $src );
	}
	return $src;
}

// Mensagem de erro de login genérica: não confirmar se o usuário existe.
add_filter( 'login_errors', fn () => __( 'Dados de acesso incorretos.', 'sal' ) );

// Cabeçalhos de proteção básicos no front (sem interferir no wp-admin).
add_action( 'send_headers', function () {
	if ( is_admin() ) {
		return;
	}
	header( 'X-Content-Type-Options: nosniff' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	header( 'Referrer-Policy: strict-origin-when-cross-origin' );
} );
