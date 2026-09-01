<?php
/** Barra de busca do blog. Args opcionais: id (para rótulo único por página). */
if ( ! defined( 'ABSPATH' ) ) { exit; }
$sal_busca_id = isset( $args['id'] ) ? $args['id'] : 'busca-blog';
?>
<form class="busca" role="search" method="get" action="<?php echo esc_url( home_url( '/blog/' ) ); ?>">
	<label class="oculto" for="<?php echo esc_attr( $sal_busca_id ); ?>">Buscar no blog</label>
	<input id="<?php echo esc_attr( $sal_busca_id ); ?>" type="search" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="Buscar no blog">
	<button class="btn btn-primary" type="submit">Buscar</button>
</form>
