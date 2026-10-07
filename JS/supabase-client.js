const SUPABASE_URL = 'https://jxbraodoqfwagefsynlc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Nm3qt7mlkERuA3F-sss9iw_CXTjKBCc';

/*
 * Create the LeaseHub Supabase client.
 *
 * The Supabase CDN uses window.supabase for the library.
 * We use leasehubSupabase for our actual client so
 * there is no naming conflict.
 */
const leasehubSupabase =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

window.LeaseHubAuth = {
  async signIn(email, password) {
    return leasehubSupabase.auth.signInWithPassword({ email, password });
  },

  async signUp({ email, password, name, phone, accountType }) {
    return leasehubSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone,
          account_type: accountType
        }
      }
    });
  },

  async getAccessToken() {
    const { data, error } = await leasehubSupabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || null;
  },

  async signOut() {
    const { error } = await leasehubSupabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('leasehub_session_token');
    localStorage.removeItem('leasehubCurrentUser');
    localStorage.removeItem('leaseHubCurrentUser');
    localStorage.removeItem('currentUser');
  }
};


/* ================= CURRENT USER ================= */

async function getCurrentUser() {

  const {
    data: { user },
    error
  } = await leasehubSupabase.auth.getUser();

  if (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }

  if (!user) {
    return null;
  }


  const { data: profile, error: profileError } =
    await leasehubSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();


  if (profileError) {
    console.error(
      'getCurrentUser profile error:',
      profileError
    );

    return {
      ...user,
      profile: null
    };
  }


  return {
    ...user,
    profile
  };
}


/* ================= REQUIRE AUTH ================= */

async function requireAuth() {

  const user = await getCurrentUser();

  if (!user) {

    window.location.href = 'login.html';

    return null;
  }

  return user;
}


/* ================= FETCH PROPERTIES ================= */

async function fetchProperties(filters = {}) {

  let query =
    leasehubSupabase
      .from('properties')
      .select('*')
      .eq('verification_status', 'approved')
      .order('created_at', {
        ascending: false
      });


  if (filters.city) {

    query = query.ilike(
      'city',
      `%${filters.city}%`
    );

  }


  if (
    filters.type &&
    filters.type !== 'all'
  ) {

    query = query.eq(
      'type',
      filters.type
    );

  }


  if (filters.maxPrice) {

    query = query.lte(
      'price',
      filters.maxPrice
    );

  }


  const {
    data,
    error
  } = await query;


  if (error) {

    console.error(
      'fetchProperties error:',
      error
    );

    return [];
  }


  return (data || []).map(property => {
    const verificationStatus = String(property.verification_status || "pending").toLowerCase();
    const image = property.image || "";
    return {
      ...property,
      id: String(property.id),
      ownerId: property.owner_id,
      ownerName: property.owner_name || "Property Owner",
      verificationStatus,
      listingStatus: verificationStatus === "approved" ? "live" : verificationStatus,
      verified: verificationStatus === "approved",
      image,
      images: Array.isArray(property.images) && property.images.length ? property.images : [image].filter(Boolean)
    };
  });
}

let propertyCatalogRequest = null;

window.loadLeaseHubPropertyCatalog = function () {
  if (propertyCatalogRequest) return propertyCatalogRequest;

  propertyCatalogRequest = (async () => {
    const listings = await fetchProperties();
    if (listings.length && Array.isArray(properties)) {
      properties.splice(0, properties.length, ...listings);
    }
    return properties;
  })().finally(() => {
    propertyCatalogRequest = null;
  });

  return propertyCatalogRequest;
};


/* ================= SAVED PROPERTIES ================= */

async function getSavedPropertyIds() {

  const user =
    await getCurrentUser();


  if (!user) {
    return [];
  }


  const {
    data,
    error
  } = await leasehubSupabase
    .from('saved_properties')
    .select('property_id')
    .eq('user_id', user.id);


  if (error) {

    console.error(
      'getSavedPropertyIds error:',
      error
    );

    return [];
  }


  return (data || [])
    .map(row => row.property_id);
}


/* ================= TOGGLE SAVE ================= */

async function toggleSave(propertyId) {

  const user =
    await getCurrentUser();


  if (!user) {

    alert(
      'Please log in to save properties'
    );

    window.location.href =
      'login.html';

    return false;
  }


  const id = String(propertyId);


  const {
    data: existing,
    error: existingError
  } = await leasehubSupabase
    .from('saved_properties')
    .select('*')
    .eq('user_id', user.id)
    .eq('property_id', id)
    .maybeSingle();


  if (existingError) {

    console.error(
      'toggleSave lookup error:',
      existingError
    );

    return false;
  }


  if (existing) {

    const {
      error
    } = await leasehubSupabase
      .from('saved_properties')
      .delete()
      .eq('user_id', user.id)
      .eq('property_id', id);


    if (error) {

      console.error(
        'toggleSave delete error:',
        error
      );

      return false;
    }


    return false;

  } else {

    const {
      error
    } = await leasehubSupabase
      .from('saved_properties')
      .insert({
        user_id: user.id,
        property_id: id
      });


    if (error) {

      console.error(
        'toggleSave insert error:',
        error
      );

      return false;
    }


    return true;
  }
}