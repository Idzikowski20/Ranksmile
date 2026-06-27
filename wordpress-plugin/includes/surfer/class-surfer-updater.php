<?php
/**
 * Self-hosted plugin updater.
 *
 * The plugin is distributed outside the wordpress.org repository, so WordPress
 * won't offer updates on its own. This checks a small JSON manifest served by the
 * connected app ( {app}/downloads/wp-plugin.json ); when it advertises a newer
 * version WordPress shows the usual "update available" + one-click update, pulling
 * the zip from the manifest's download URL.
 *
 * @package SurferSEO
 * @link https://surferseo.com
 */

namespace SurferSEO\Surfer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Hooks WordPress' update pipeline against our own manifest.
 */
class Surfer_Updater {

	/**
	 * Plugin basename, e.g. "surferseo/surferseo.php".
	 *
	 * @var string
	 */
	private $basename;

	/**
	 * Plugin folder slug, e.g. "surferseo".
	 *
	 * @var string
	 */
	private $slug;

	/**
	 * Register the update hooks.
	 */
	public function __construct() {
		$this->basename = plugin_basename( SURFER_PLUGIN_FILE );
		$this->slug     = dirname( $this->basename );

		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
		add_filter( 'plugins_api', array( $this, 'plugin_info' ), 20, 3 );
		add_action( 'upgrader_process_complete', array( $this, 'clear_cache' ), 10, 0 );
	}

	/**
	 * Fetch (and cache) the remote update manifest from the connected app.
	 *
	 * @return object|false
	 */
	private function get_remote_info() {
		$cached = get_transient( 'surfer_update_info' );
		if ( false !== $cached ) {
			return $cached;
		}

		$base = rtrim( Surfer()->get_surfer()->get_surfer_url(), '/' );
		$res  = wp_remote_get( $base . '/downloads/wp-plugin.json', array( 'timeout' => 10 ) );

		if ( is_wp_error( $res ) || 200 !== wp_remote_retrieve_response_code( $res ) ) {
			return false;
		}

		$info = json_decode( wp_remote_retrieve_body( $res ) );
		if ( ! $info || empty( $info->version ) || empty( $info->download ) ) {
			return false;
		}

		// Resolve a relative download path against the app base, so the same manifest
		// works regardless of the app URL (localhost vs production).
		if ( 0 !== strpos( $info->download, 'http' ) ) {
			$info->download = $base . '/' . ltrim( $info->download, '/' );
		}

		set_transient( 'surfer_update_info', $info, 6 * HOUR_IN_SECONDS );
		return $info;
	}

	/**
	 * Inject our update into the WordPress update transient.
	 *
	 * @param object $transient - the update_plugins transient.
	 * @return object
	 */
	public function check_for_update( $transient ) {
		if ( empty( $transient->checked ) ) {
			return $transient;
		}

		$info = $this->get_remote_info();
		if ( ! $info ) {
			return $transient;
		}

		$payload = array(
			'slug'        => $this->slug,
			'plugin'      => $this->basename,
			'new_version' => $info->version,
			'package'     => $info->download,
			'url'         => isset( $info->homepage ) ? $info->homepage : '',
			'tested'      => isset( $info->tested ) ? $info->tested : '',
			'requires'    => isset( $info->requires ) ? $info->requires : '',
		);

		if ( version_compare( SURFER_VERSION, $info->version, '<' ) ) {
			$transient->response[ $this->basename ] = (object) $payload;
		} else {
			// Tell WordPress the plugin is current (avoids a false "unknown" state).
			$payload['new_version']                  = SURFER_VERSION;
			$payload['package']                      = '';
			$transient->no_update[ $this->basename ] = (object) $payload;
		}

		return $transient;
	}

	/**
	 * Provide the "View details" modal data.
	 *
	 * @param false|object|array $result - default result.
	 * @param string             $action - API action.
	 * @param object             $args   - request args.
	 * @return false|object
	 */
	public function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) || $args->slug !== $this->slug ) {
			return $result;
		}

		$info = $this->get_remote_info();
		if ( ! $info ) {
			return $result;
		}

		return (object) array(
			'name'          => isset( $info->name ) ? $info->name : 'Surfer',
			'slug'          => $this->slug,
			'version'       => $info->version,
			'requires'      => isset( $info->requires ) ? $info->requires : '',
			'tested'        => isset( $info->tested ) ? $info->tested : '',
			'download_link' => $info->download,
			'sections'      => array(
				'changelog' => isset( $info->changelog ) ? $info->changelog : '',
			),
		);
	}

	/**
	 * Drop the cached manifest after an update runs.
	 */
	public function clear_cache() {
		delete_transient( 'surfer_update_info' );
	}
}
