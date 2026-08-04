<?php
/**
 * Minimal in-app navigation — connection hub + advanced only.
 *
 * @package Ranksmile
 */

namespace Ranksmile\Admin\RSDS;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * IA nav.
 */
class Nav {

	/**
	 * @return array<int,array{label?:string,items:array<int,array{slug:string,label:string,section?:string}>}>
	 */
	public static function groups() {
		return array(
			array(
				'items' => array(
					array( 'slug' => 'ranksmile', 'label' => __( 'Dashboard', 'ranksmileseo' ) ),
				),
			),
			array(
				'label' => __( 'Setup', 'ranksmileseo' ),
				'items' => array(
					array(
						'slug'    => 'ranksmile-settings',
						'section' => 'advanced',
						'label'   => __( 'Advanced', 'ranksmileseo' ),
					),
				),
			),
		);
	}

	/**
	 * @param string $current_slug    Current page slug.
	 * @param string $current_section Settings section (optional).
	 * @return string
	 */
	public static function render( $current_slug, $current_section = '' ) {
		ob_start();
		echo '<div class="rs-settings-nav__title">' . esc_html__( 'Ranksmile', 'ranksmileseo' ) . '</div>';
		foreach ( self::groups() as $group ) {
			echo '<div class="rs-settings-nav__group">';
			if ( ! empty( $group['label'] ) ) {
				echo '<div class="rs-settings-nav__group-title">' . esc_html( $group['label'] ) . '</div>';
			}
			echo '<ul class="rs-settings-nav__list">';
			foreach ( $group['items'] as $item ) {
				$section = isset( $item['section'] ) ? (string) $item['section'] : '';
				$active  = ( $item['slug'] === $current_slug );
				$classes = 'rs-settings-nav__item' . ( $active ? ' rs-settings-nav__item--active' : '' );
				if ( '' !== $section ) {
					$url = admin_url( 'admin.php?page=' . $item['slug'] . '&section=' . rawurlencode( $section ) );
				} else {
					$url = admin_url( 'admin.php?page=' . $item['slug'] );
				}
				echo '<li>';
				echo '<a class="' . esc_attr( $classes ) . '" href="' . esc_url( $url ) . '"' . ( $active ? ' aria-current="page"' : '' ) . '>';
				echo '<span class="rs-settings-nav__item-inner"><span class="rs-settings-nav__label">' . esc_html( $item['label'] ) . '</span></span>';
				echo '</a></li>';
			}
			echo '</ul></div>';
		}
		return (string) ob_get_clean();
	}
}
