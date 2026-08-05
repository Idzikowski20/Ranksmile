<?php
/**
 *  Main object to control plugin.
 *
 * @package Ranksmile
 * @link https://ranksmile.pl
 */

namespace Ranksmile;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Ranksmile\Autoloader;
use Ranksmile\Seo_Manager;
use Ranksmile\Plugin\Ranksmile;
use Ranksmile\Admin\Ranksmile_Settings;
use Ranksmile\Admin\Ranksmile_Admin;
use Ranksmile\Plugin\Ranksmile_Tracking;
use Ranksmile\Plugin\Ranksmile_Sidebar;

/**
 * General object to control plugin.
 */
class Ranksmileseo {

	/**
	 * Object Singleton
	 *
	 * @var Ranksmileseo
	 */
	protected static $instance = null;

	/**
	 * Current version of the plugin
	 *
	 * @var string
	 */
	public $version = null;

	/**
	 * Basedir to the plugin (example: public_html/wp-content/plugins/ranksmileseo/src/)
	 *
	 * @var string
	 */
	protected $basedir = null;

	/**
	 * URL to the plugin (example: https://example.com/wp-content/plugins/ranksmileseo/src/)
	 *
	 * @var string
	 */
	protected $baseurl = null;

	/**
	 * Object that contain all Ranksmile features.
	 *
	 * @var Ranksmile
	 */
	protected $ranksmile = null;

	/**
	 * Object that contain wp-admin functions.
	 *
	 * @var Ranksmile_Admin
	 */
	protected $ranksmile_admin = null;

	/**
	 * Object to manage Ranksmile forms.
	 *
	 * @var Ranksmile_Forms
	 */
	protected $ranksmile_forms = null;

	/**
	 * Contains configuration.
	 *
	 * @var Ranksmile_Settings
	 */
	protected $ranksmile_settings = null;

	/**
	 * Contains things related to SEO but not connected to Ranksmile directly.
	 *
	 * @var Seo_Manager
	 */
	protected $seo_manager = null;

	/**
	 * Class to handle PHP files auto load.
	 *
	 * @var Autoloader
	 */
	protected $autoloader = null;

	/**
	 * Class to handle all integrations.
	 *
	 * @var Ranksmile_Tracking
	 */
	protected $ranksmile_tracking = null;

	/**
	 * Class to handle all integrations.
	 *
	 * @var Ranksmile_Sidebar
	 */
	protected $ranksmile_sidebar = null;

	/**
	 * URL to WPRanksmile documentation page.
	 *
	 * @var string
	 */
	public $url_wpranksmile_docs = 'https://ranksmile.pl/en/collections/3548643-wordpress-plugin';

	/**
	 * URL to Ranksmile contact page.
	 *
	 * @var string
	 */
	public $url_wpranksmile_support = 'https://ranksmile.pl/contact/';

	/**
	 * Object constructor.
	 */
	protected function __construct() {

		$this->basedir = dirname( __DIR__ );
		$this->baseurl = plugin_dir_url( __DIR__ );

		$this->version = RANKSMILE_VERSION;

		$this->init_hooks();

		add_filter( 'plugin_action_links_ranksmileseo/ranksmileseo.php', array( $this, 'add_actions_links' ) );

		add_filter( 'safe_style_css', array( $this, 'allow_display' ) );
		add_filter( 'cron_schedules', array( $this, 'add_monthly_schedule' ) );

		$this->make_imports();
	}

	/**
	 * Singleton
	 *
	 * Creates if NULL and returns Ranksmileseo instance.
	 *
	 * @return Ranksmileseo
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Returns plugin basedir.
	 *
	 * @return string
	 */
	public function get_basedir() {
		return $this->basedir;
	}

	/**
	 * Returns plugin base url.
	 *
	 * @return string
	 */
	public function get_baseurl() {
		return $this->baseurl;
	}

	/**
	 * Returns general ranksmile object.
	 *
	 * @return Ranksmile
	 */
	public function get_plugin() {
		return $this->ranksmile;
	}

	/**
	 * Returns object that manage forms.
	 *
	 * @return Ranksmile_Forms
	 */
	public function get_ranksmile_forms() {
		return $this->ranksmile_forms;
	}

	/**
	 * Returns object that manage settings
	 *
	 * @return Ranksmile_Settings
	 */
	public function get_ranksmile_settings() {
		return $this->ranksmile_settings;
	}

	/**
	 * Returns object that manage SEO related things not connected to Ranksmile.
	 *
	 * @return Seo_Manager
	 */
	public function get_seo_manager() {
		return $this->seo_manager;
	}

	/**
	 * Returns object that handle tracking features
	 *
	 * @return Ranksmile_Tracking;
	 */
	public function get_ranksmile_tracking() {
		return $this->ranksmile_tracking;
	}

	/**
	 * Installation hooks.
	 *
	 * @return void
	 */
	public function init_hooks() {

		require_once $this->basedir . '/includes/class-ranksmile-installer.php';
		$installer = new Ranksmile_Installer();

		register_activation_hook( RANKSMILE_PLUGIN_FILE, array( $installer, 'install' ) );

		add_action( 'upgrader_process_complete', array( $installer, 'ranksmile_upgrade_completed' ), 10, 2 );
	}

	/**
	 * Adds links in wp-admin -> Plugins page.
	 *
	 * @param array $actions - default actions.
	 * @return array
	 */
	public function add_actions_links( $actions ) {

		$my_links = array(
			'<a href="' . admin_url( 'admin.php?page=ranksmile' ) . '">' . __( 'Settings', 'ranksmileseo' ) . '</a>',
			'<a href="' . $this->url_wpranksmile_support . '" target="_blank">' . __( 'Support', 'ranksmileseo' ) . '</a>',
		);

		$actions = array_merge( $actions, $my_links );
		return $actions;
	}

	/**
	 * Function that includes all required classes.
	 *
	 * @return void
	 */
	private function make_imports() {

		$this->import_general_imports();

		if ( is_admin() ) {
			$this->import_admin_imports();
		} else {
			$this->import_frontend_imports();
		}
	}

	/**
	 * Makes general imports for the plugin.
	 */
	private function import_general_imports() {

		require_once $this->basedir . '/includes/functions.php';
		require_once $this->basedir . '/includes/class-autoloader.php';
		$this->autoloader = new Autoloader();

		$this->ranksmile_tracking = new Ranksmile_Tracking();
		$this->ranksmile_settings = new Ranksmile_Settings();
		$this->ranksmile          = new Ranksmile();
		$this->seo_manager     = new Seo_Manager();
		$this->ranksmile_sidebar  = new Ranksmile_Sidebar();
	}

	/**
	 * Makes imports related to wp-admin section.
	 */
	private function import_admin_imports() {

		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
		$this->ranksmile_admin = new Ranksmile_Admin();
	}

	/**
	 * Includes styles and scripts in wp-admin
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts( $hook_suffix = '' ) {
		unset( $hook_suffix );

		if ( ! function_exists( 'get_current_screen' ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( empty( $screen ) ) {
			return;
		}

		
		// RSDS design layer (tokens → theme → components → legacy).
		$rsds = $this->baseurl . 'assets/design/';
		wp_enqueue_style( 'ranksmile-rsds-tokens', $rsds . 'tokens/design-tokens.css', array(), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-rsds-theme', $rsds . 'themes/theme.css', array( 'ranksmile-rsds-tokens' ), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-rsds-components', $rsds . 'components/components.bundle.css', array( 'ranksmile-rsds-theme' ), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-rsds-legacy', $rsds . 'overrides/legacy.css', array( 'ranksmile-rsds-components' ), RANKSMILE_VERSION );

		wp_enqueue_style( 'ranksmile-components', $this->baseurl . 'assets/css/components.css', array(), RANKSMILE_VERSION );

		// Only load Ranksmile styles on Ranksmile admin pages or post editor screens where Ranksmile UI is used.
		$is_ranksmile_page = ( false !== strpos( (string) $screen->id, 'toplevel_page_ranksmile' ) )
			|| ( 0 === strpos( (string) $screen->id, 'ranksmile_page_' ) );

		$is_post_editor = ( 'post' === (string) $screen->base )
			&& ! empty( $screen->post_type )
			&& function_exists( 'ranksmile_return_supported_post_types' )
			&& in_array( $screen->post_type, ranksmile_return_supported_post_types(), true );

		if ( ! $is_ranksmile_page && ! $is_post_editor ) {
			return;
		}

		wp_enqueue_style( 'ranksmile-admin', $this->baseurl . 'assets/css/admin.css', array( 'ranksmile-components' ), RANKSMILE_VERSION );
		wp_enqueue_style( 'ranksmile-styles', $this->baseurl . 'assets/css/ranksmileseo.css', array( 'ranksmile-components' ), RANKSMILE_VERSION );
		// Design-system override — must load last so its rules win by source order.
		wp_enqueue_style( 'ranksmile-redesign', $this->baseurl . 'assets/css/ranksmile-redesign.css', array( 'ranksmile-components', 'ranksmile-admin', 'ranksmile-styles' ), RANKSMILE_VERSION );
	}

	/**
	 * Makes imports related to front-end.
	 */
	private function import_frontend_imports() {
	}

	/**
	 * Allow to use display style in wp_kses.
	 *
	 * @param array $styles - array of safe styles.
	 * @return array
	 */
	public function allow_display( $styles ) {

		$styles[] = 'display';
		return $styles;
	}

	/**
	 * Adds monthly schedule to WP Cron.
	 *
	 * @param array $schedules - array of schedules.
	 * @return array
	 */
	public function add_monthly_schedule( $schedules ) {

		if ( ! isset( $schedules['monthly'] ) ) {
			$schedules['monthly'] = array(
				'interval' => 30 * DAY_IN_SECONDS,
				// Intentionally not translated to avoid triggering JIT translation loading too early.
				// This filter can run before init in some WP flows (WP 6.7+ warns about early i18n loading).
				'display'  => 'Monthly',
			);
		}

		return $schedules;
	}
}
