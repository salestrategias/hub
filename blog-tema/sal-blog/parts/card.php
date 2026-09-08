<?php
/**
 * Card de artigo, usado no portal, nas editorias, na busca e nos relacionados.
 * Recebe via $args: post (WP_Post) e, opcionalmente, grande (bool).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

$p   = $args['post'];
$cat = sal_categoria( $p );
$img = get_the_post_thumbnail_url( $p, 'sal-card' );
?>
<article class="card<?php echo ! empty( $args['grande'] ) ? ' card-grande' : ''; ?>">
	<a href="<?php echo esc_url( get_permalink( $p ) ); ?>">
		<figure>
			<?php if ( $img ) : ?>
				<img src="<?php echo esc_url( $img ); ?>" alt="<?php echo esc_attr( get_the_title( $p ) ); ?>" loading="lazy" decoding="async" width="640" height="360">
			<?php else : ?>
				<span class="sem-capa" aria-hidden="true"></span>
			<?php endif; ?>
		</figure>
		<div class="card-corpo">
			<?php if ( $cat ) : ?><span class="card-cat"><?php echo esc_html( $cat->name ); ?></span><?php endif; ?>
			<h3><?php echo esc_html( get_the_title( $p ) ); ?></h3>
			<time datetime="<?php echo esc_attr( get_the_date( 'c', $p ) ); ?>"><?php echo esc_html( sal_data( $p ) ); ?></time>
		</div>
	</a>
</article>
