<?php
/**
 * Comentários (mínimo funcional — o blog da SAL normalmente os mantém fechados).
 *
 * @package sal
 */

if ( post_password_required() ) {
	return;
}
?>

<section class="comentarios" id="comentarios">
	<?php if ( have_comments() ) : ?>
		<h2>
			<?php
			/* translators: %s: quantidade de comentários. */
			printf( esc_html( _n( '%s comentário', '%s comentários', get_comments_number(), 'sal' ) ), esc_html( number_format_i18n( get_comments_number() ) ) );
			?>
		</h2>
		<ol class="lista-comentarios">
			<?php wp_list_comments( array( 'style' => 'ol', 'avatar_size' => 0, 'short_ping' => true ) ); ?>
		</ol>
		<?php the_comments_navigation(); ?>
	<?php endif; ?>

	<?php if ( comments_open() ) : ?>
		<?php comment_form(); ?>
	<?php elseif ( get_comments_number() ) : ?>
		<p><?php esc_html_e( 'Os comentários estão fechados.', 'sal' ); ?></p>
	<?php endif; ?>
</section>
