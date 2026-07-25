<?php
/**
 * Object to manage SEO related features, but not connected to Ranksmile directly.
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Object to manage SEO related features, but not connected to Ranksmile directly.
 */
class Seo_Manager {

	/**
	 * Object constructor.
	 */
	public function __construct() {
		add_action( 'wp_head', array( $this, 'display_gsc_html_tag_in_head' ) );
	}

	/**
	 * Displays tag saved in configuration provided by GSC.
	 *
	 * @return void
	 */
	public function display_gsc_html_tag_in_head() {
		$allow_meta = array(
			'meta' => array(
				'name'    => array(),
				'content' => array(),
			),
		);

		$html_tag = Ranksmile()->get_ranksmile_settings()->get_option( 'content-importer', 'ranksmile_gsc_meta_script', false );
		if ( false !== $html_tag ) {
			echo wp_kses( stripslashes( $html_tag ), $allow_meta );
		}
	}
}
