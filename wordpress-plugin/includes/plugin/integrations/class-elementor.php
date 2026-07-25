<?php
/**
 *  Object that stores integrations objects.
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile\Plugin\Integrations;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Core\DocumentTypes\PageBase;

/**
 * Content exporter object.
 */
class Elementor {



	/**
	 * The identifier for the elementor tab.
	 */
	const RANKSMILE_TAB = 'ranksmile-tab';

	/**
	 * Object construct.
	 */
	public function __construct() {

		add_action( 'init', array( $this, 'init_hooks' ) );
	}

	/**
	 * Initialize hooks.
	 */
	public function init_hooks() {

		add_action( 'elementor/editor/after_enqueue_styles', array( $this, 'enqueue_scripts_and_styles_in_elementor' ) );
		add_action( 'elementor/documents/register_controls', array( $this, 'register_document_controls' ) );
	}

	/**
	 * Enqueue scripts and styles in Elementor.
	 */
	public function enqueue_scripts_and_styles_in_elementor() {

		wp_enqueue_style( 'ranksmile-components', Ranksmile()->get_baseurl() . 'assets/css/components.css', array(), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-styles', Ranksmile()->get_baseurl() . 'assets/css/ranksmileseo.css', array(), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-elementor-integration', Ranksmile()->get_baseurl() . 'assets/css/ranksmile-elementor-integration.css', array(), RANKSMILE_VERSION );

		Ranksmile()->get_plugin()->enqueue_ranksmile_react_apps();
	}

	/**
	 * Register a panel tab slug, in order to allow adding controls to this tab.
	 */
	public function add_ranksmile_panel_tab() {
		Controls_Manager::add_tab( $this::RANKSMILE_TAB, 'Ranksmile' );
	}

	/**
	 * Register additional document controls.
	 *
	 * https://developers.elementor.com/docs/editor/page-settings-panel/
	 *
	 * @param PageBase $document The PageBase document.
	 */
	public function register_document_controls( $document ) {

		// PageBase is the base class for documents like `post` `page` and etc.
		if ( ! $document instanceof PageBase || ! $document::get_property( 'has_elements' ) ) {
			return;
		}
	}
}
