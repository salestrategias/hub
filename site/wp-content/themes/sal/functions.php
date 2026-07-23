<?php
/**
 * SAL — funções do tema.
 *
 * Cada responsabilidade vive em inc/ para o arquivo principal ficar legível:
 *  - setup.php        suportes do tema, menus, imagens
 *  - assets.php       CSS/JS com versão por filemtime, preload de fontes
 *  - performance.php  cabeçalho enxuto, sem emoji script, sem jQuery no front
 *  - security.php     endurecimento seguro para tema (XML-RPC, versão, etc.)
 *  - seo.php          meta description, Open Graph e schema.org com fallback
 *  - customizer.php   textos da home, contato e redes editáveis no Personalizar
 *  - template-tags.php helpers de exibição usados pelos templates
 *
 * @package sal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SAL_VERSION', '1.0.0' );

require get_template_directory() . '/inc/setup.php';
require get_template_directory() . '/inc/assets.php';
require get_template_directory() . '/inc/performance.php';
require get_template_directory() . '/inc/security.php';
require get_template_directory() . '/inc/seo.php';
require get_template_directory() . '/inc/customizer.php';
require get_template_directory() . '/inc/template-tags.php';
require get_template_directory() . '/inc/conteudo.php';

// Regras de URL do CPT de materiais passam a valer ao ativar o tema.
add_action( 'after_switch_theme', 'flush_rewrite_rules' );
