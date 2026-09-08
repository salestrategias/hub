<?php
/**
 * Formulário de busca.
 *
 * @package sal
 */
?>
<form role="search" method="get" class="busca-form" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label class="screen-reader-text" for="campo-busca"><?php esc_html_e( 'Buscar no site', 'sal' ); ?></label>
	<input type="search" id="campo-busca" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="<?php esc_attr_e( 'O que você procura?', 'sal' ); ?>">
	<button type="submit" class="btn btn--solido btn--mini"><?php esc_html_e( 'Buscar', 'sal' ); ?></button>
</form>
