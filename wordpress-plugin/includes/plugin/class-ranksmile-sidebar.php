<?php
/**
 *  Object that manage sidebar in Gutenberg
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Ranksmile\Ranksmileseo;

/**
 * Object responsible for handling Ranksmile sidebar.
 */
class Ranksmile_Sidebar {


	/**
	 * Object construct.
	 */
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'include_ranksmile_sidebar_scripts' ) );

		add_action( 'add_meta_boxes', array( $this, 'add_post_export_meta_box' ) );
	}

	/**
	 * Enqueue sidebar script.
	 */
	public function include_ranksmile_sidebar_scripts() {

		$screen = get_current_screen();
		if ( ! in_array( $screen->post_type, ranksmile_return_supported_post_types(), true ) ) {
			return;
		}

		$base_url = Ranksmileseo::get_instance()->get_baseurl();

		wp_enqueue_style(
			'ranksmile-sidebar',
			$base_url . 'assets/css/ranksmile-sidebar.css',
			array(),
			RANKSMILE_VERSION
		);
	}

	/**
	 * Creates metabox where we will store writing guidelines in iFrame.
	 *
	 * @return void
	 */
	public function add_post_export_meta_box() {
		$current_screen = get_current_screen();

		$allowed_post_types = ranksmile_return_supported_post_types();

		// Add meta box only in classic editor (in Gutenberg we have sidebar).
		if ( ! $current_screen->is_block_editor() ) {
			add_meta_box(
				'ranksmile_export_content',
				__( 'Optimize', 'ranksmileseo' ),
				array( $this, 'render_content_export_box' ),
				$allowed_post_types,
				'side',
				'default'
			);
		}
	}

	/**
	 * Displays content of the content export box
	 *
	 * @return void
	 */
	public function render_content_export_box() {

		?>
			<div key="ranksmile-guidelines" id="ranksmile-content-export-box"></div>
		<?php
	}
}
